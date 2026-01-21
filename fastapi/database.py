import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = MongoClient(MONGO_URI)
db = client['hadith_db']
translations_collection = db['translations']
kitabs_collection = db['kitabs']
book_info_collection = db['book_info']
