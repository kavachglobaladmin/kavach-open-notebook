# Per-Transformation Model Selection Feature

## Overview
This implementation adds the ability to select a specific model for each transformation. When a transformation has a model assigned, that model will be used instead of the default model when executing the transformation.

## Changes Made

### 1. Backend - Domain Model
**File**: `open_notebook/domain/transformation.py`
- Added optional `model_id` field to the `Transformation` class
- Allows storing a specific model ID per transformation

### 2. Backend - API Models
**File**: `api/models.py`
- Updated `TransformationCreate` to include optional `model_id` field
- Updated `TransformationUpdate` to include optional `model_id` field
- Updated `TransformationResponse` to include optional `model_id` field

### 3. Backend - API Router
**File**: `api/routers/transformations.py`
- Updated `create_transformation()` to handle `model_id`
- Updated `get_transformations()` to return `model_id`
- Updated `get_transformation()` to return `model_id`
- Updated `update_transformation()` to handle `model_id` updates

### 4. Backend - Transformation Graph
**File**: `open_notebook/graphs/transformation.py`
- Updated `run_transformation()` to use transformation's `model_id` as fallback
- Priority: config model_id > transformation.model_id > default model

### 5. Database Migration
**Files**: 
- `open_notebook/database/migrations/21.surrealql` - Adds `model_id` field
- `open_notebook/database/migrations/21_down.surrealql` - Rollback migration

### 6. Frontend - Types
**File**: `frontend/src/lib/types/transformations.ts`
- Added optional `model_id` field to `Transformation` interface
- Added optional `model_id` field to `CreateTransformationRequest`
- Added optional `model_id` field to `UpdateTransformationRequest`

### 7. Frontend - UI Component
**File**: `frontend/src/app/(dashboard)/transformations/components/TransformationCard.tsx`
- Added model selector button (⚡ icon) on each transformation row
- Button shows blue highlight when a model is selected
- Clicking button opens a dialog to select/change the model
- Dialog includes:
  - ModelSelector component for language models
  - Save and Cancel buttons
  - Loading state during save

### 8. Frontend - Translations
**File**: `frontend/src/lib/locales/en-US/index.ts`
- Added `selectModelDesc` - "Choose a specific model for this transformation"
- Added `noModelSelected` - "Use default model"

## User Experience

### How It Works
1. User navigates to Transformations page
2. On each transformation row, there's a ⚡ (lightning bolt) button on the left
3. Clicking the button opens a dialog to select a language model
4. User selects a model and clicks "Save"
5. The button turns blue to indicate a model is assigned
6. When executing this transformation, the assigned model will be used

### Model Selection Priority
When executing a transformation:
1. If a model is explicitly passed in the request → use that
2. Else if the transformation has a model_id → use that
3. Else → use the default model for transformations

## Files Modified
- `open_notebook/domain/transformation.py`
- `api/models.py`
- `api/routers/transformations.py`
- `open_notebook/graphs/transformation.py`
- `frontend/src/lib/types/transformations.ts`
- `frontend/src/app/(dashboard)/transformations/components/TransformationCard.tsx`
- `frontend/src/lib/locales/en-US/index.ts`

## Files Created
- `open_notebook/database/migrations/21.surrealql`
- `open_notebook/database/migrations/21_down.surrealql`

## Testing Recommendations
1. Create a new transformation and verify you can select a model
2. Execute the transformation and verify the selected model is used
3. Update an existing transformation to add/change the model
4. Verify the model selector button shows the correct state (blue when model selected)
5. Test with different model types to ensure proper filtering
6. Verify the migration runs successfully on API startup

## Notes
- The feature is fully backward compatible - existing transformations without a model_id will continue to use the default model
- The model selector only shows language models (filtered by type)
- The feature integrates seamlessly with the existing transformation execution flow
