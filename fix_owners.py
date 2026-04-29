import asyncio, sys, os
sys.path.insert(0, '.')
os.environ['SURREAL_URL'] = 'ws://127.0.0.1:8000/rpc'
os.environ['SURREAL_USER'] = 'root'
os.environ['SURREAL_PASSWORD'] = 'root'
os.environ['SURREAL_NAMESPACE'] = 'open_notebook'
os.environ['SURREAL_DATABASE'] = 'open_notebook'
from open_notebook.database.repository import repo_query, ensure_record_id

async def main():
    notebooks = await repo_query('SELECT id FROM notebook')
    print(f'Total notebooks: {len(notebooks)}')
    
    for nb in notebooks:
        nb_id = ensure_record_id(str(nb['id']))
        # Use raw SurrealDB query to set owner to null explicitly
        result = await repo_query(
            "UPDATE $id SET owner = $owner",
            {"id": nb_id, "owner": "krunal.rawal@kavachglobal.com"}
        )
        owner_val = result[0].get('owner') if result else 'N/A'
        print(f'Updated: {nb["id"]} -> owner={owner_val}')
    
    # Verify with raw query
    check = await repo_query('SELECT id, name, owner FROM notebook')
    print('\n--- Verification ---')
    for r in check:
        print(f"  {r.get('name')} | owner={r.get('owner')}")

asyncio.run(main())
