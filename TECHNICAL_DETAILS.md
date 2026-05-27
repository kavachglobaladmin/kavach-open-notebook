# Per-Transformation Model Selection - Technical Details

## Architecture

### Data Flow

```
Frontend (React)
    ↓
TransformationCard Component
    ├─ Displays ⚡ button
    ├─ Opens ModelSelector Dialog
    └─ Calls useUpdateTransformation hook
        ↓
API Client (transformationsApi.update)
    ↓
FastAPI Backend
    ├─ PUT /transformations/{id}
    └─ Updates transformation with model_id
        ↓
SurrealDB
    └─ Stores model_id in transformation record
        ↓
When Executing Transformation:
    ├─ LangGraph transformation.py
    ├─ Reads transformation.model_id
    ├─ Passes to provision_langchain_model()
    └─ Uses model for execution
```

## Database Schema

### Transformation Table

```sql
DEFINE TABLE transformation SCHEMAFULL;

DEFINE FIELD id ON TABLE transformation TYPE string;
DEFINE FIELD name ON TABLE transformation TYPE string;
DEFINE FIELD title ON TABLE transformation TYPE string;
DEFINE FIELD description ON TABLE transformation TYPE string;
DEFINE FIELD prompt ON TABLE transformation TYPE string;
DEFINE FIELD apply_default ON TABLE transformation TYPE bool;
DEFINE FIELD model_id ON TABLE transformation TYPE option<string>;  -- NEW
DEFINE FIELD created ON TABLE transformation TYPE datetime;
DEFINE FIELD updated ON TABLE transformation TYPE datetime;
```

## API Endpoints

### Create Transformation
```
POST /transformations
Content-Type: application/json

{
  "name": "dense_summary",
  "title": "Dense Summary",
  "description": "Creates a concise summary",
  "prompt": "Summarize this content...",
  "apply_default": true,
  "model_id": "model-uuid-123"  // Optional
}

Response:
{
  "id": "transformation-uuid",
  "name": "dense_summary",
  "title": "Dense Summary",
  "description": "Creates a concise summary",
  "prompt": "Summarize this content...",
  "apply_default": true,
  "model_id": "model-uuid-123",
  "created": "2024-01-01T00:00:00Z",
  "updated": "2024-01-01T00:00:00Z"
}
```

### Update Transformation
```
PUT /transformations/{id}
Content-Type: application/json

{
  "model_id": "model-uuid-456"  // Can update just the model_id
}

Response: Updated transformation object
```

### Get Transformation
```
GET /transformations/{id}

Response: Transformation object with model_id field
```

### List Transformations
```
GET /transformations

Response: Array of transformation objects with model_id fields
```

## Backend Implementation

### Model Selection Logic

**File**: `open_notebook/graphs/transformation.py`

```python
async def run_transformation(state: dict, config: RunnableConfig) -> dict:
    # ... setup code ...
    
    # Priority: config model_id > transformation.model_id > default
    model_id = config.get("configurable", {}).get("model_id") or transformation.model_id
    
    # Use model_id in provision_langchain_model()
    chain = await provision_langchain_model(
        content, model_id, "transformation", **kwargs
    )
```

### Provision Logic

**File**: `open_notebook/ai/provision.py`

```python
async def provision_langchain_model(
    content, model_id, default_type, **kwargs
) -> BaseChatModel:
    """
    Returns the best model to use based on:
    1. If model_id is provided → use that model
    2. If content > 105_000 tokens → use large_context_model
    3. Otherwise → use default model for type
    """
    tokens = token_count(content)
    
    if tokens > 105_000:
        model = await model_manager.get_default_model("large_context", **kwargs)
    elif model_id:
        model = await model_manager.get_model(model_id, **kwargs)
    else:
        model = await model_manager.get_default_model(default_type, **kwargs)
    
    return model.to_langchain()
```

## Frontend Implementation

### Component Structure

**File**: `frontend/src/app/(dashboard)/transformations/components/TransformationCard.tsx`

```typescript
export function TransformationCard({ transformation, onPlayground, onEdit }) {
  const [showModelDialog, setShowModelDialog] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState(transformation.model_id || '')
  const updateTransformation = useUpdateTransformation()

  const handleSaveModel = async () => {
    if (selectedModelId !== transformation.model_id) {
      await updateTransformation.mutateAsync({
        id: transformation.id,
        data: { model_id: selectedModelId || undefined }
      })
    }
    setShowModelDialog(false)
  }

  return (
    <>
      {/* Model selector button */}
      <button
        onClick={() => setShowModelDialog(true)}
        className={transformation.model_id ? 'bg-blue-50' : 'text-slate-400'}
      >
        <Zap className="h-4 w-4" />
      </button>

      {/* Model selector dialog */}
      <Dialog open={showModelDialog} onOpenChange={setShowModelDialog}>
        <ModelSelector
          modelType="language"
          value={selectedModelId}
          onChange={setSelectedModelId}
        />
        <button onClick={handleSaveModel}>Save</button>
      </Dialog>
    </>
  )
}
```

### State Management

Uses TanStack Query (React Query) for server state:

```typescript
export function useUpdateTransformation() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }) => transformationsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ 
        queryKey: TRANSFORMATION_QUERY_KEYS.transformations 
      })
      queryClient.invalidateQueries({ 
        queryKey: TRANSFORMATION_QUERY_KEYS.transformation(id) 
      })
    }
  })
}
```

## Type Definitions

### TypeScript Interfaces

**File**: `frontend/src/lib/types/transformations.ts`

```typescript
export interface Transformation {
  id: string
  name: string
  title: string
  description: string
  prompt: string
  apply_default: boolean
  model_id?: string  // NEW
  created: string
  updated: string
}

export interface CreateTransformationRequest {
  name: string
  title: string
  description: string
  prompt: string
  apply_default?: boolean
  model_id?: string  // NEW
}

export interface UpdateTransformationRequest {
  name?: string
  title?: string
  description?: string
  prompt?: string
  apply_default?: boolean
  model_id?: string  // NEW
}
```

### Python Models

**File**: `api/models.py`

```python
class TransformationCreate(BaseModel):
    name: str
    title: str
    description: str
    prompt: str
    apply_default: bool = False
    model_id: Optional[str] = None  # NEW

class TransformationResponse(BaseModel):
    id: str
    name: str
    title: str
    description: str
    prompt: str
    apply_default: bool
    model_id: Optional[str] = None  # NEW
    created: str
    updated: str
```

## Database Migration

### Migration 21

**File**: `open_notebook/database/migrations/21.surrealql`

```sql
-- Migration 21: Add model_id field to transformation table
-- Allows per-transformation model selection

DEFINE FIELD OVERWRITE model_id ON TABLE transformation TYPE option<string>;
```

**File**: `open_notebook/database/migrations/21_down.surrealql`

```sql
-- Migration 21 rollback: Remove model_id field from transformation table

DEFINE FIELD OVERWRITE model_id ON TABLE transformation TYPE option<string> VALUE null;
```

### Migration Execution

The migration runs automatically on API startup via `AsyncMigrationManager`:

```python
# In api/main.py
async def lifespan(app: FastAPI):
    # ... other startup code ...
    migration_manager = AsyncMigrationManager(db)
    await migration_manager.run_migrations()
    # ... rest of startup ...
```

## Backward Compatibility

- Existing transformations without `model_id` will have `model_id = None`
- When `model_id` is `None`, the default model is used
- No breaking changes to existing API contracts
- Frontend gracefully handles missing `model_id` field

## Testing

### Unit Tests

```python
# Test transformation with model_id
async def test_transformation_with_model_id():
    transformation = Transformation(
        name="test",
        title="Test",
        description="Test transformation",
        prompt="Test prompt",
        model_id="model-123"
    )
    await transformation.save()
    
    retrieved = await Transformation.get(transformation.id)
    assert retrieved.model_id == "model-123"

# Test model selection priority
async def test_model_selection_priority():
    # Config model_id takes priority
    model_id = config.get("configurable", {}).get("model_id") or transformation.model_id
    assert model_id == config_model_id
```

### Integration Tests

```python
# Test transformation execution with assigned model
async def test_execute_transformation_with_assigned_model():
    transformation = await Transformation.get(transformation_id)
    
    result = await transformation_graph.ainvoke(
        {"input_text": "test content", "transformation": transformation},
        config={"configurable": {"model_id": None}}  # No override
    )
    
    # Should use transformation.model_id
    assert result["output"] is not None
```

## Performance Considerations

1. **Database Query**: Adding `model_id` field has minimal impact (single optional string field)
2. **API Response**: Slightly larger JSON responses (one additional field per transformation)
3. **Model Selection**: No performance impact - same logic as before, just with fallback

## Security Considerations

1. **Model Validation**: The API validates that the model_id exists before saving
2. **Access Control**: Uses existing authentication/authorization
3. **No Sensitive Data**: model_id is just a UUID reference, no credentials stored

## Future Enhancements

1. **Model Templates**: Save model configurations as templates
2. **Batch Model Assignment**: Assign same model to multiple transformations
3. **Model Versioning**: Track which model version was used for each execution
4. **Model Performance Metrics**: Track execution time and cost per model
5. **Auto-Selection**: Suggest optimal models based on transformation type
