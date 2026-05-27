# Notification Center Usage Guide

The NotificationCenter component provides a global notification system with a bell icon in the top-right corner of the app.

## Features

- **Bell Icon**: Located in the top-right corner of the header
- **Unread Badge**: Shows count of unread notifications
- **Notification Types**: info, success, warning, error (with color-coded styling)
- **Save Feature**: Users can save important notifications for later reference
- **Auto-cleanup**: Keeps only the last 50 notifications in memory

## How to Use

### 1. Add a Notification from Any Component

```typescript
import { useAddNotification } from '@/lib/hooks/use-add-notification'

export function MyComponent() {
  const { addNotification } = useAddNotification()

  const handleSuccess = () => {
    addNotification({
      title: 'Success',
      message: 'Your transformation has been completed successfully',
      type: 'success',
    })
  }

  const handleError = () => {
    addNotification({
      title: 'Error',
      message: 'Failed to process the file',
      type: 'error',
    })
  }

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
    </div>
  )
}
```

### 2. Notification Types

```typescript
// Success notification
addNotification({
  title: 'Transformation Complete',
  message: 'Dense Summary generated successfully',
  type: 'success',
})

// Error notification
addNotification({
  title: 'Error',
  message: 'Failed to generate mindmap',
  type: 'error',
})

// Warning notification
addNotification({
  title: 'Warning',
  message: 'Large file may take longer to process',
  type: 'warning',
})

// Info notification
addNotification({
  title: 'Info',
  message: 'Processing started',
  type: 'info',
})
```

### 3. Integration Points

Consider adding notifications to:

- **Transformation Execution**: When a transformation starts/completes/fails
- **Model Selection**: When a model is selected for a transformation
- **File Upload**: When files are uploaded successfully
- **Search Operations**: When search completes
- **Chat Messages**: When chat responses are received
- **Podcast Generation**: When podcast generation completes
- **API Errors**: When API calls fail

## Component Structure

The NotificationCenter is integrated into `AppShell.tsx` and appears in the header:

```
┌─────────────────────────────────────────────────────┐
│                                          🔔 (Bell)  │  <- NotificationCenter
├─────────────────────────────────────────────────────┤
│ SetupBanner (if needed)                             │
├─────────────────────────────────────────────────────┤
│ Main Content                                        │
└─────────────────────────────────────────────────────┘
```

## Notification Dropdown Features

- **Sticky Header**: Shows notification count and "Clear all" button
- **Notification List**: Displays all notifications with type-based colors
- **Save Button**: Click the save icon to bookmark important notifications
- **Saved Section**: Shows saved notifications at the bottom
- **Auto-dismiss**: Notifications stay until user clears them
- **Timestamp**: Each notification shows when it was created

## Future Enhancements

- [ ] Persist saved notifications to localStorage
- [ ] Add notification sound/desktop notifications
- [ ] Add notification filtering by type
- [ ] Add notification search
- [ ] Add notification expiration time
- [ ] Add notification actions (undo, retry, etc.)
