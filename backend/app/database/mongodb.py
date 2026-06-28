import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "eduagent_v2"

class MongoDBConnection:
    def __init__(self):
        self.client: AsyncIOMotorClient = None
        self.db = None

    async def connect(self):
        try:
            logger.info("Connecting to MongoDB...")
            self.client = AsyncIOMotorClient(MONGODB_URI)
            self.db = self.client[DATABASE_NAME]
            # Verify connection
            await self.client.admin.command('ping')
            logger.info("Connected to MongoDB successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise e

    async def close(self):
        if self.client:
            logger.info("Closing MongoDB connection...")
            self.client.close()
            logger.info("MongoDB connection closed.")

_connection = MongoDBConnection()

# Exported connection functions
async def connect_db():
    await _connection.connect()

async def close_db():
    await _connection.close()

# Proxy class for db to support dynamic resolution after connect_db is called
class DatabaseProxy:
    def __getattr__(self, name):
        if _connection.db is None:
            raise RuntimeError("Database connection not initialized. Please call 'connect_db()' first.")
        return getattr(_connection.db, name)

    def __getitem__(self, name):
        if _connection.db is None:
            raise RuntimeError("Database connection not initialized. Please call 'connect_db()' first.")
        return _connection.db[name]

# Exported db proxy
db = DatabaseProxy()
