# Testing Guide

This document provides guidelines for writing tests in Open i_Notes. Testing is critical to maintaining code quality and preventing regressions.

## Testing Philosophy

### What to Test

Focus on testing the things that matter most:

- **Business Logic** - Core domain models and their operations
- **API Contracts** - HTTP endpoint behavior and error handling
- **Critical Workflows** - End-to-end flows that users depend on
- **Data Persistence** - Database operations and data integrity
- **Error Conditions** - How the system handles failures gracefully

### What NOT to Test

Don't waste time testing framework code:

- Framework functionality (FastAPI, React, etc.)
- Third-party library implementation
- Simple getters/setters without logic
- View/presentation layer rendering (unless it contains logic)

## Test Structure

We use **pytest** with async support for all Python tests:

```python
import pytest
from httpx import AsyncClient
from open_i_Notes.domain.i_Notes import i_Notes

@pytest.mark.asyncio
async def test_create_i_Notes():
    """Test i_Notes creation."""
    i_Notes = i_Notes(name="Test i_Notes", description="Test description")
    await i_Notes.save()

    assert i_Notes.id is not None
    assert i_Notes.name == "Test i_Notes"
    assert i_Notes.created is not None

@pytest.mark.asyncio
async def test_api_create_i_Notes():
    """Test i_Notes creation via API."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/i_Notes",
            json={"name": "Test i_Notes", "description": "Test description"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test i_Notes"
```

## Test Categories

### 1. Unit Tests

Test individual functions and methods in isolation:

```python
@pytest.mark.asyncio
async def test_i_Notes_validation():
    """Test that i_Notes name validation works."""
    with pytest.raises(InvalidInputError):
        i_Notes(name="", description="test")

@pytest.mark.asyncio
async def test_i_Notes_archive():
    """Test i_Notes archiving."""
    i_Notes = i_Notes(name="Test", description="")
    i_Notes.archive()
    assert i_Notes.archived is True
```

**Location**: `tests/unit/`

### 2. Integration Tests

Test component interactions and database operations:

```python
@pytest.mark.asyncio
async def test_create_i_Notes_with_sources():
    """Test creating a i_Notes and adding sources."""
    i_Notes = await create_i_Notes(name="Research", description="")
    source = await add_source(i_Notes_id=i_Notes.id, url="https://example.com")

    retrieved = await get_i_Notes_with_sources(i_Notes.id)
    assert len(retrieved.sources) == 1
    assert retrieved.sources[0].id == source.id
```

**Location**: `tests/integration/`

### 3. API Tests

Test HTTP endpoints and error responses:

```python
@pytest.mark.asyncio
async def test_get_i_Notes_endpoint():
    """Test GET /i_Notes endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/i_Notes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

@pytest.mark.asyncio
async def test_create_i_Notes_validation():
    """Test that invalid input is rejected."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/i_Notes",
            json={"name": "", "description": ""}
        )
        assert response.status_code == 400
```

**Location**: `tests/api/`

### 4. Database Tests

Test data persistence and query correctness:

```python
@pytest.mark.asyncio
async def test_save_and_retrieve_i_Notes():
    """Test saving and retrieving a i_Notes from database."""
    i_Notes = i_Notes(name="Test", description="desc")
    await i_Notes.save()

    retrieved = await i_Notes.get(i_Notes.id)
    assert retrieved.name == "Test"
    assert retrieved.description == "desc"

@pytest.mark.asyncio
async def test_query_by_criteria():
    """Test querying i_Notes by criteria."""
    await create_i_Notes("Active", "")
    await create_i_Notes("Archived", "")

    active = await repo_query(
        "SELECT * FROM i_Notes WHERE archived = false"
    )
    assert len(active) >= 1
```

**Location**: `tests/database/`

## Running Tests

### Run All Tests

```bash
uv run pytest
```

### Run Specific Test File

```bash
uv run pytest tests/test_i_Notes.py
```

### Run Specific Test Function

```bash
uv run pytest tests/test_i_Notes.py::test_create_i_Notes
```

### Run with Coverage Report

```bash
uv run pytest --cov=open_i_Notes
```

### Run Only Unit Tests

```bash
uv run pytest tests/unit/
```

### Run Only Integration Tests

```bash
uv run pytest tests/integration/
```

### Run Tests in Verbose Mode

```bash
uv run pytest -v
```

### Run Tests with Output

```bash
uv run pytest -s
```

## Test Fixtures

Use pytest fixtures for common setup and teardown:

```python
import pytest

@pytest.fixture
async def test_i_Notes():
    """Create a test i_Notes."""
    i_Notes = i_Notes(name="Test i_Notes", description="Test description")
    await i_Notes.save()
    yield i_Notes
    await i_Notes.delete()

@pytest.fixture
async def api_client():
    """Create an API test client."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
async def test_i_Notes_with_sources(test_i_Notes):
    """Create a test i_Notes with sample sources."""
    source1 = Source(i_Notes_id=test_i_Notes.id, url="https://example.com")
    source2 = Source(i_Notes_id=test_i_Notes.id, url="https://example.org")
    await source1.save()
    await source2.save()

    test_i_Notes.sources = [source1, source2]
    yield test_i_Notes

    # Cleanup
    await source1.delete()
    await source2.delete()
```

## Best Practices

### 1. Write Descriptive Test Names

```python
# Good - clearly describes what is being tested
async def test_create_i_Notes_with_valid_name_succeeds():
    ...

# Bad - vague about what's being tested
async def test_i_Notes():
    ...
```

### 2. Use Docstrings

```python
@pytest.mark.asyncio
async def test_vector_search_returns_sorted_results():
    """Test that vector search results are sorted by relevance score."""
    # Implementation
```

### 3. Test Edge Cases

```python
@pytest.mark.asyncio
async def test_search_with_empty_query():
    """Test that empty query raises error."""
    with pytest.raises(InvalidInputError):
        await vector_search("")

@pytest.mark.asyncio
async def test_search_with_very_long_query():
    """Test that very long query is handled."""
    long_query = "x" * 10000
    results = await vector_search(long_query)
    assert isinstance(results, list)

@pytest.mark.asyncio
async def test_search_with_special_characters():
    """Test that special characters are handled."""
    results = await vector_search("@#$%^&*()")
    assert isinstance(results, list)
```

### 4. Use Assertions Effectively

```python
# Good - specific assertions
assert i_Notes.name == "Test"
assert len(i_Notes.sources) == 3
assert i_Notes.created is not None

# Less good - too broad
assert i_Notes is not None
assert i_Notes  # ambiguous what's being tested
```

### 5. Test Both Success and Failure Cases

```python
@pytest.mark.asyncio
async def test_create_i_Notes_success():
    """Test successful i_Notes creation."""
    i_Notes = await create_i_Notes(name="Research", description="AI")
    assert i_Notes.id is not None
    assert i_Notes.name == "Research"

@pytest.mark.asyncio
async def test_create_i_Notes_empty_name_fails():
    """Test that empty name raises error."""
    with pytest.raises(InvalidInputError):
        await create_i_Notes(name="", description="")

@pytest.mark.asyncio
async def test_create_i_Notes_duplicate_fails():
    """Test that duplicate names are handled."""
    await create_i_Notes(name="Research", description="")
    with pytest.raises(DuplicateError):
        await create_i_Notes(name="Research", description="")
```

### 6. Keep Tests Independent

```python
# Good - test is self-contained
@pytest.mark.asyncio
async def test_archive_i_Notes():
    i_Notes = i_Notes(name="Test", description="")
    await i_Notes.save()
    await i_Notes.archive()
    assert i_Notes.archived is True

# Bad - depends on another test's state
@pytest.mark.asyncio
async def test_archive_existing_i_Notes():
    # Assumes test_create_i_Notes ran first
    await i_Notes.archive()  # i_Notes undefined
```

### 7. Use Fixtures for Reusable Setup

```python
# Instead of repeating setup:
@pytest.fixture
async def client_with_auth(api_client, mock_auth):
    """Client with authentication set up."""
    api_client.headers.update({"Authorization": f"Bearer {mock_auth.token}"})
    yield api_client

@pytest.mark.asyncio
async def test_protected_endpoint(client_with_auth):
    """Test protected endpoint."""
    response = await client_with_auth.get("/api/protected")
    assert response.status_code == 200
```

## Coverage Goals

- Aim for 70%+ overall coverage
- 90%+ coverage for critical business logic
- Don't obsess over 100% - focus on meaningful tests
- Use `--cov` flag to check coverage: `uv run pytest --cov=open_i_Notes`

## Async Test Patterns

### Testing Async Functions

```python
@pytest.mark.asyncio
async def test_async_operation():
    """Test async function."""
    result = await some_async_function()
    assert result is not None
```

### Testing Concurrent Operations

```python
@pytest.mark.asyncio
async def test_concurrent_i_Notes_creation():
    """Test creating multiple i_Notes concurrently."""
    tasks = [
        create_i_Notes(f"i_Notes {i}", "")
        for i in range(10)
    ]
    i_Notes = await asyncio.gather(*tasks)
    assert len(i_Notes) == 10
    assert all(n.id for n in i_Notes)
```

## Common Testing Errors

### Error: "event loop is closed"

Solution: Use the async fixture properly:
```python
@pytest.fixture
async def i_Notes():  # Use async fixture
    i_Notes = i_Notes(name="Test", description="")
    await i_Notes.save()
    yield i_Notes
    await i_Notes.delete()
```

### Error: "object is not awaitable"

Solution: Make sure you're using await:
```python
# Wrong
result = create_i_Notes("Test", "")

# Right
result = await create_i_Notes("Test", "")
```

---

**See also:**
- [Code Standards](code-standards.md) - Code formatting and style
- [Contributing Guide](contributing.md) - Overall contribution workflow
