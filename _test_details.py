import asyncio
from open_notebook.bank_statement.pipeline import run_pipeline_async

async def main():
    result = await run_pipeline_async("data/uploads/ACCT STATEMENT.pdf", None)
    details = result.get('details', {})
    print("issuer_lines:", details.get('issuer_lines', []))
    print("customer_lines:", details.get('customer_lines', []))
    print("title:", details.get('title', ''))
    print("\nDetail cards:")
    for f in result.get('detail_cards', []):
        print(f"  {f['label']}: {f['value']}")
    print("\nFrequency:", result.get('frequency', {}))

asyncio.run(main())
