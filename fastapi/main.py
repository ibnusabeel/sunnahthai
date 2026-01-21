from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from database import translations_collection, kitabs_collection
from models import HadithModel, HadithUpdateModel
from services import translate_hadith
from seed import seed_sample_hadith
import datetime
import os

app = FastAPI(title="Hadith Translation System API")

# Admin dashboard route - serve HTML
@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard():
    """Serve the main admin dashboard page."""
    template_path = os.path.join(os.path.dirname(__file__), "templates", "admin.html")
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()

# Admin kitabs page route - serve HTML
@app.get("/admin/kitabs", response_class=HTMLResponse)
async def admin_kitabs_page():
    """Serve the admin kitabs management page."""
    template_path = os.path.join(os.path.dirname(__file__), "templates", "admin_kitabs.html")
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4321", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/seed")
async def run_seed():
    """
    Seeds the database with sample Arabic data.
    """
    return seed_sample_hadith()

@app.get("/api/books")
async def list_books():
    """
    Returns list of all unique books in the database with counts.
    """
    pipeline = [
        {"$group": {
            "_id": "$hadith_book",
            "total": {"$sum": 1},
            "translated": {"$sum": {"$cond": [{"$eq": ["$status", "translated"]}, 1, 0]}}
        }},
        {"$sort": {"total": -1}}
    ]
    
    result = translations_collection.aggregate(pipeline)
    books = []
    for doc in result:
        if doc["_id"]:
            total = doc["total"]
            translated = doc["translated"]
            
            # Override for Ahmad (as requested by user)
            if doc["_id"] == "ahmad":
                total = 26363
                
            books.append({
                "book": doc["_id"],
                "total": total,
                "translated": translated,
                "pending": total - translated,
                "percentage": round((translated / total) * 100) if total > 0 else 0
            })
    
    return {"books": books}

@app.get("/api/hadith/{id}", response_model=HadithModel)
async def get_hadith(id: str):
    """
    Get a single hadith by ID.
    """
    hadith = translations_collection.find_one({"hadith_id": id})
    if not hadith:
        raise HTTPException(status_code=404, detail="Hadith not found")
    return hadith

@app.get("/api/hadiths")
@app.get("/api/hadiths/{book}")
async def list_hadiths(
    book: str = None,
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    search: str = Query(""),
    status: str = Query(""),
    kitab: str = Query("")
):
    """
    Returns paginated list of hadiths for a specific book with optional filters.
    """
    query = {}
    conditions = []
    
    # Filter by book if provided
    if book:
        conditions.append({"hadith_book": book})
    
    # Filter by status if provided
    if status:
        conditions.append({"status": status})
    
    # Filter by kitab if provided (check ar, th, and en fields)
    if kitab:
        kitab_query = {
            "$or": [
                {"kitab.ar": kitab},
                {"kitab.th": kitab},
                {"kitab.en": kitab}
            ]
        }
        conditions.append(kitab_query)
    
    # Search filter
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        search_query = {
            "$or": [
                {"hadith_id": search_regex},
                {"content.ar": search_regex},
                {"content.th": search_regex},
                {"kitab.ar": search_regex},
                {"kitab.th": search_regex}
            ]
        }
        conditions.append(search_query)
    
    # Combine all conditions
    if conditions:
        query = {"$and": conditions} if len(conditions) > 1 else conditions[0]

    skip = (page - 1) * limit
    cursor = translations_collection.find(query).skip(skip).limit(limit)
    hadiths = []
    for doc in cursor:
        doc.pop("_id", None)
        hadiths.append(doc)
    
    total_count = translations_collection.count_documents(query)
    
    return {
        "book": book,
        "data": hadiths,
        "page": page,
        "limit": limit,
        "total": total_count,
        "total_pages": (total_count + limit - 1) // limit
    }

@app.get("/api/kitabs/{book}")
async def list_kitabs(book: str):
    """
    Returns list of kitabs for a specific book from the kitabs collection.
    Falls back to aggregation if collection is empty.
    """
    # Try to get from new kitabs collection first
    kitabs = list(kitabs_collection.find(
        {"book": book}, 
        {"_id": 0}
    ).sort("order", 1))
    
    if kitabs:
        # Format response from new collection
        return {
            "book": book, 
            "kitabs": [
                {
                    "kitab_id": k.get("kitab_id"),
                    "ar": k.get("name", {}).get("ar", ""),
                    "th": k.get("name", {}).get("th", ""),
                    "en": k.get("name", {}).get("en", ""),
                    "id": k.get("order"),
                    "hadith_count": k.get("hadith_count", 0)
                } for k in kitabs
            ]
        }
    
    # Fallback: aggregate from translations (old method)
    query = {"hadith_book": book} if book else {}
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "hadith_no_int": {
                "$convert": {
                    "input": "$hadith_no",
                    "to": "int",
                    "onError": 9999999,
                    "onNull": 9999999
                }
            }
        }},
        {"$group": {
            "_id": {"ar": "$kitab.ar", "th": "$kitab.th"},
            "en": {"$first": "$kitab.en"},
            "id": {"$min": "$kitab.id"},
            "min_hadith": {"$min": "$hadith_no_int"}
        }},
        {"$sort": {"id": 1, "min_hadith": 1, "_id.th": 1}}
    ]
    
    result = translations_collection.aggregate(pipeline)
    kitabs_list = []
    seen = set()
    
    for doc in result:
        ar = doc["_id"].get("ar", "") or ""
        th = doc["_id"].get("th", "") or ""
        en = doc.get("en", "") or ""
        id = doc.get("id")
        
        key = th or en or ar
        if key and key not in seen:
            seen.add(key)
            kitabs_list.append({"ar": ar, "th": th, "en": en, "id": id})
    
    return {"book": book, "kitabs": kitabs_list}

# ============ KITABS CRUD ENDPOINTS ============

@app.get("/api/kitab/{kitab_id}")
async def get_kitab(kitab_id: str):
    """Get a single kitab by ID."""
    kitab = kitabs_collection.find_one({"kitab_id": kitab_id}, {"_id": 0})
    if not kitab:
        raise HTTPException(status_code=404, detail="Kitab not found")
    return kitab

@app.post("/api/kitabs")
async def create_kitab(kitab: dict):
    """Create a new kitab."""
    import datetime
    
    # Validate required fields
    if not kitab.get("kitab_id") or not kitab.get("book"):
        raise HTTPException(status_code=400, detail="kitab_id and book are required")
    
    # Check if already exists
    existing = kitabs_collection.find_one({"kitab_id": kitab["kitab_id"]})
    if existing:
        raise HTTPException(status_code=409, detail="Kitab with this ID already exists")
    
    # Add timestamps
    kitab["created_at"] = datetime.datetime.utcnow()
    kitab["updated_at"] = datetime.datetime.utcnow()
    
    kitabs_collection.insert_one(kitab)
    return {"message": "Kitab created", "kitab_id": kitab["kitab_id"]}

@app.put("/api/kitab/{kitab_id}")
async def update_kitab(kitab_id: str, updates: dict):
    """Update an existing kitab."""
    import datetime
    
    existing = kitabs_collection.find_one({"kitab_id": kitab_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Kitab not found")
    
    # Remove protected fields
    updates.pop("_id", None)
    updates.pop("kitab_id", None)
    updates.pop("created_at", None)
    
    # Add updated timestamp
    updates["updated_at"] = datetime.datetime.utcnow()
    
    # Capture old info for comparison BEFORE update
    book_id = existing.get("book")
    old_name = existing.get("name", {})
    old_th = old_name.get("th")
    old_ar = old_name.get("ar")
    old_en = old_name.get("en")
    
    kitabs_collection.update_one(
        {"kitab_id": kitab_id},
        {"$set": updates}
    )
    
    # Propagate changes to translations_collection if names changed
    new_name = updates.get("name", {})
    
    if book_id and new_name:
        # Update Thai name if changed
        new_th = new_name.get("th")
        if new_th and new_th != old_th:
            translations_collection.update_many(
                {"hadith_book": book_id, "kitab.th": old_th},
                {"$set": {"kitab.th": new_th}}
            )
            
        # Update Arabic name if changed
        new_ar = new_name.get("ar")
        if new_ar and new_ar != old_ar:
            translations_collection.update_many(
                {"hadith_book": book_id, "kitab.ar": old_ar},
                {"$set": {"kitab.ar": new_ar}}
            )

        # Update English name if changed
        new_en = new_name.get("en")
        if new_en and new_en != old_en:
            translations_collection.update_many(
                {"hadith_book": book_id, "kitab.en": old_en},
                {"$set": {"kitab.en": new_en}}
            )
    
    return {"message": "Kitab updated", "kitab_id": kitab_id}

@app.delete("/api/kitab/{kitab_id}")
async def delete_kitab(kitab_id: str):
    """Delete a kitab."""
    result = kitabs_collection.delete_one({"kitab_id": kitab_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kitab not found")
    return {"message": "Kitab deleted", "kitab_id": kitab_id}

@app.post("/api/hadith/{id}/translate", response_model=HadithModel)
async def translate_hadith_endpoint(id: str, retranslate: bool = Query(False)):
    """
    Triggers translation for a specific ID.
    """
    # Fetch hadith
    hadith = translations_collection.find_one({"hadith_id": id})
    if not hadith:
        raise HTTPException(status_code=404, detail="Hadith not found")
    
    # Check if already translated and not retranslating
    if hadith.get("status") == "translated" and not retranslate:
         return hadith

    try:
        # Call translation service
        translation_result = translate_hadith(hadith, is_retranslate=retranslate)
        
        # Update fields
        update_data = {
            "kitab.th": translation_result.get("kitab_th"),
            "bab.th": translation_result.get("bab_th"),
            "content.th": translation_result.get("content_th"),
            "status": "translated",
            "last_updated": datetime.datetime.utcnow(),
            "notes": translation_result.get("notes") # Storing optional notes
        }

        # Perform update
        # Using $set to update specific nested fields without overwriting the whole document structure unnecessarily
        # However, for nested objects like kitab.th, dot notation in keys is required for mongo
        mongo_update = {
            "$set": {
                "kitab.th": translation_result.get("kitab_th"),
                "bab.th": translation_result.get("bab_th"),
                "content.th": translation_result.get("content_th"),
                "status": "translated",
                "last_updated": datetime.datetime.utcnow(),
                "translation_notes": translation_result.get("notes")
            }
        }
        
        translations_collection.update_one({"hadith_id": id}, mongo_update)
        
        # Fetch updated document
        updated_hadith = translations_collection.find_one({"hadith_id": id})
        return updated_hadith

    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Translation Error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@app.put("/api/hadith/{id}", response_model=HadithModel)
async def update_hadith_endpoint(id: str, update_data: HadithUpdateModel):
    """
    Manually update a Hadith (e.g. correct translation).
    """
    existing = translations_collection.find_one({"hadith_id": id})
    if not existing:
        raise HTTPException(status_code=404, detail="Hadith not found")

    # Build update dict, excluding None
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if not update_dict:
        return existing
        
    update_dict["last_updated"] = datetime.datetime.utcnow()
    
    # Flatten nested dictionaries for dot notation update if necessary, 
    # OR replace whole objects. Pydantic .dict() usually gives nested dicts.
    # For simplicity and correctness with Pydantic models as sub-fields, 
    # we can iterate and set specific fields if we want partial sub-document updates,
    # but replacing the whole 'kitab' object is often cleaner if the client sends the whole object.
    
    translations_collection.update_one({"hadith_id": id}, {"$set": update_dict})
    
    return translations_collection.find_one({"hadith_id": id})

    return translations_collection.find_one({"hadith_id": id})

# ============ BOOK INFO ENDPOINTS ============
from database import book_info_collection

@app.get("/api/book-info/{book}")
async def get_book_info(book: str):
    """Get book metadata (description, etc)."""
    info = book_info_collection.find_one({"book": book}, {"_id": 0})
    if not info:
        return {"book": book, "description": "", "created_at": None}
    return info

@app.put("/api/book-info/{book}")
async def update_book_info(book: str, data: dict):
    """Update book metadata."""
    import datetime
    
    description = data.get("description", "")
    
    info = {
        "book": book,
        "description": description,
        "updated_at": datetime.datetime.utcnow()
    }
    
    book_info_collection.update_one(
        {"book": book},
        {"$set": info},
        upsert=True
    )
    
    return info

# Static Files (Must be last to avoid conflict)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Create static directory if not exists
if not os.path.exists("static"):
    os.makedirs("static")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    return FileResponse("static/index.html")

@app.get("/api/stats")
@app.get("/api/stats/{book}")
async def get_stats(book: str = None):
    """
    Get stats for dashboard, optionally filtered by book.
    """
    query = {}
    if book:
        query["hadith_book"] = book
    
    total = translations_collection.count_documents(query)
    translated = translations_collection.count_documents({**query, "status": "translated"})
    
    # Override for Ahmad (as requested by user)
    if book == "ahmad":
        total = 26363
    elif book is None:
        # Global stats - must adjust for Ahmad difference
        ahmad_real = translations_collection.count_documents({"hadith_book": "ahmad"})
        ahmad_target = 26363
        if ahmad_real < ahmad_target:
             total += (ahmad_target - ahmad_real)

    pending = total - translated
    
    return {
        "book": book,
        "overall": {
            "total": total,
            "translated": translated,
            "pending": pending,
            "percentage": round((translated / total * 100), 2) if total > 0 else 0
        }
    }


@app.post("/api/kitabs/sync/{book}")
async def sync_kitabs_names(book: str):
    """
    Force sync kitab names from kitabs_collection to translations_collection.
    Matches primarily by 'id' (order) which corresponds to kitab.id in translations.
    """
    kitabs = list(kitabs_collection.find({"book": book}))
    if not kitabs:
         raise HTTPException(status_code=404, detail="No kitabs found for this book in kitabs collection")
    
    updated_count = 0
    
    for k in kitabs:
        order_id = k.get("order")
        name = k.get("name", {})
        
        if order_id is None:
            continue
            
        # Match hadiths with this book and this kitab.id (order)
        # Note: kitab.id in translations might be int string or int.
        # We try both just in case.
        
        updates = {}
        if name.get("th"): updates["kitab.th"] = name.get("th")
        if name.get("ar"): updates["kitab.ar"] = name.get("ar")
        if name.get("en"): updates["kitab.en"] = name.get("en")
        
        if not updates:
            continue

        # Try matching integer ID first
        res = translations_collection.update_many(
            {"hadith_book": book, "kitab.id": order_id},
            {"$set": updates}
        )
        updated_count += res.modified_count
        
        # Try matching string ID just in case
        res_str = translations_collection.update_many(
            {"hadith_book": book, "kitab.id": str(order_id)},
            {"$set": updates}
        )
        updated_count += res_str.modified_count
        
    return {"message": f"Synced {updated_count} hadiths for book {book}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
