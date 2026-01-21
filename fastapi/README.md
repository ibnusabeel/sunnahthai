# Hadith Translation System API

## Prerequisite
Ensure the server is running:
```bash
uvicorn main:app --reload
```

## How to Use

### 1. Seed the Database
Populate the database with sample data.
```bash
curl -X POST http://localhost:8000/api/seed
```
Or use the Swagger UI: [http://localhost:8000/docs#/default/run_seed_api_seed_post](http://localhost:8000/docs#/default/run_seed_api_seed_post)

### 2. Translate a Hadith
Trigger the translation for the seeded Hadith (ID: `bukhari_1`).
```bash
curl -X POST "http://localhost:8000/api/hadith/bukhari_1/translate"
```
Or use the Swagger UI: [http://localhost:8000/docs#/default/translate_hadith_endpoint_api_hadith__id__translate_post](http://localhost:8000/docs#/default/translate_hadith_endpoint_api_hadith__id__translate_post)

### 3. View the Result
Retrieve the translated Hadith.
```bash
curl http://localhost:8000/api/hadith/bukhari_1
```

## Adding More Data
You can modify `seed.py` to add more Hadith samples and re-run the seed command.
