# Per-Transformation Model Selection - User Guide

## Feature Overview

You can now assign a specific AI model to each transformation. When you execute a transformation that has a model assigned, that model will be used instead of the default transformation model.

This is useful when you want:
- Different transformations to use different models (e.g., Dense Summary with Claude, Mindmap with GPT-4)
- Specific models optimized for certain tasks
- Cost optimization by using cheaper models for simple transformations

## How to Use

### 1. Accessing the Feature

Navigate to **Transformations** page in the left sidebar.

### 2. Selecting a Model for a Transformation

On the Transformations list, each transformation row has a **⚡ (lightning bolt)** button on the left side:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ [Transformation Name]                    [Playground] [Edit] [Delete] │
│    Description of what this transformation does              │
└─────────────────────────────────────────────────────────────┘
```

**To assign a model:**
1. Click the ⚡ button
2. A dialog will open showing available language models
3. Select the model you want to use
4. Click "Save"

The button will turn **blue** to indicate a model is assigned.

### 3. Model Selection Dialog

When you click the ⚡ button, you'll see:

```
┌─────────────────────────────────────────────────────────────┐
│ Select Model                                                 │
│ Choose a specific model for this transformation              │
│                                                              │
│ [Model Dropdown ▼]                                           │
│   - Claude 3.5 Sonnet (Anthropic)                           │
│   - GPT-4 Turbo (OpenAI)                                    │
│   - Gemini Pro (Google)                                     │
│   - Llama 2 (Meta)                                          │
│                                                              │
│                                    [Cancel] [Save]           │
└─────────────────────────────────────────────────────────────┘
```

### 4. Execution Behavior

When you execute a transformation:

**If a model is assigned to the transformation:**
- The assigned model will be used
- The button shows blue ⚡

**If no model is assigned:**
- The default transformation model will be used
- The button shows gray ⚡

**If you override during execution:**
- If you select a different model in the Playground, that model takes priority
- The transformation's assigned model is used as a fallback

## Examples

### Example 1: Dense Summary with Claude
1. Go to Transformations
2. Find "Dense Summary" transformation
3. Click the ⚡ button
4. Select "Claude 3.5 Sonnet"
5. Click Save
6. Now whenever you use Dense Summary, Claude will be used

### Example 2: Mindmap with GPT-4
1. Go to Transformations
2. Find "Mind Map" transformation
3. Click the ⚡ button
4. Select "GPT-4 Turbo"
5. Click Save
6. Mindmaps will now be generated using GPT-4

### Example 3: Cost Optimization
1. For quick summaries, assign a cheaper model (e.g., GPT-3.5)
2. For complex analysis, assign a more capable model (e.g., Claude 3.5)
3. This way you optimize both cost and quality

## Model Priority

When executing a transformation, the system uses this priority:

1. **Explicitly selected model** (if you select one in Playground) → Use that
2. **Transformation's assigned model** (if set) → Use that
3. **Default transformation model** (from Settings) → Use that

## Visual Indicators

| Button State | Meaning |
|---|---|
| ⚡ (gray) | No model assigned - uses default |
| ⚡ (blue) | Model assigned - uses that specific model |

## Tips & Best Practices

1. **Test before assigning**: Use the Playground to test a transformation with different models before assigning one
2. **Document your choices**: Add notes in the transformation description about why you chose a specific model
3. **Monitor costs**: Different models have different pricing - check your provider's pricing before assigning expensive models
4. **Consistency**: Assign the same model to related transformations for consistent results
5. **Fallback**: If a model becomes unavailable, the system will fall back to the default model

## Troubleshooting

### The model selector button doesn't appear
- Make sure you're on the Transformations page
- Refresh the page if needed
- Check that you have language models configured in Settings → Models

### I can't select a model
- Ensure you have at least one language model configured
- Go to Settings → Models and add a language model
- Refresh the page

### The assigned model isn't being used
- Check that the model is still available in Settings → Models
- Try re-assigning the model
- Check the API logs for any errors

### I want to remove the assigned model
- Click the ⚡ button
- Leave the model selector empty
- Click Save
- The button will return to gray

## Related Features

- **Playground**: Test transformations with different models before assigning
- **Models Settings**: Configure available models
- **Default Transformation Model**: Set the fallback model for all transformations
