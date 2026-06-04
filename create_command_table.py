"""
One-time script to create the 'command' table in SurrealDB.
Run with: uv run --env-file .env python create_command_table.py
"""
import asyncio
import os
from surrealdb import AsyncSurreal


async def main():
    url = os.environ["SURREAL_URL"].strip()
    user = os.environ["SURREAL_USER"]
    password = os.environ["SURREAL_PASSWORD"]
    namespace = os.environ["SURREAL_NAMESPACE"]
    database = os.environ["SURREAL_DATABASE"]

    print(f"Connecting to {url} ...")
    db = AsyncSurreal(url)
    await db.signin({"username": user, "password": password})
    await db.use(namespace, database)
    print(f"Connected. Using {namespace}/{database}")

    sql = """
        DEFINE TABLE IF NOT EXISTS command SCHEMALESS;
        DEFINE INDEX IF NOT EXISTS idx_command_status ON TABLE command COLUMNS status;
        DEFINE INDEX IF NOT EXISTS idx_command_app    ON TABLE command COLUMNS app_id;
    """

    result = await db.query(sql)
    print("Result:", result)
    await db.close()
    print("Done. 'command' table created successfully.")


if __name__ == "__main__":
    asyncio.run(main())
