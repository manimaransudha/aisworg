# API Contracts

**Phase**: 7 - Implementation (aka: Build, Delivery, Engineering Execution, Construction, Maker Sprint)  
**Deliverable Type**: API Specification  
**Template Purpose**: Define detailed API contracts for all endpoints with request/response schemas  
**Last Updated**: November 2025

## Template Purpose

*API contracts define the exact interface between frontend and backend systems, including request/response formats, validation rules, and error handling. This document serves as the definitive reference for API implementation and ensures consistency across all endpoints. Use this template to document your API contracts with sufficient detail for both implementation and testing.*

## API Overview

### Base Configuration
*Template: Define base URL, versioning strategy, and common headers*

**Base URL**: `https://api.noteshare.com`  
**API Version**: `v1`  
**Full Base URL**: `https://api.noteshare.com/api/v1`

**Common Headers**:
```http
Content-Type: application/json
Authorization: Bearer {jwt_token}
X-Request-ID: {unique_request_id}
X-Client-Version: {client_version}
```

**Rate Limiting**:
- 1000 requests per hour for authenticated users
- 100 requests per hour for unauthenticated users
- Rate limit headers included in all responses

### Response Format Standards
*Template: Define consistent response structure across all endpoints*

**Success Response Format**:
```json
{
  "data": {
    // Response payload
  },
  "meta": {
    "timestamp": "2025-11-06T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

**Error Response Format**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-11-06T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

## Authentication Endpoints

### POST /api/v1/auth/login
*Template: Document authentication endpoint with all possible scenarios*

**Description**: Authenticate user with email/password or SSO

**Request Body**:
```json
{
  "email": "user@company.com",
  "password": "securePassword123",
  "organizationDomain": "company.com",
  "mfaCode": "123456" // Optional, required if MFA is enabled
}
```

**Request Schema**:
```typescript
interface LoginRequest {
  email: string;           // Required, valid email format
  password?: string;       // Required for password auth
  organizationDomain: string; // Required, organization identifier
  mfaCode?: string;       // Optional, 6-digit TOTP code
  ssoProvider?: 'google' | 'microsoft' | 'okta'; // Optional, for SSO
}
```

**Success Response (200)**:
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_1234567890abcdef",
    "expiresIn": 86400,
    "user": {
      "id": "usr_123456789",
      "email": "user@company.com",
      "name": "John Doe",
      "role": "editor",
      "organization": {
        "id": "org_123456789",
        "name": "Acme Corporation",
        "domain": "company.com"
      },
      "permissions": ["notes:read", "notes:write", "notes:share"]
    }
  },
  "meta": {
    "timestamp": "2025-11-06T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

**Error Responses**:
```json
// 401 - Invalid credentials
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}

// 423 - Account locked
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account locked due to multiple failed login attempts",
    "details": {
      "lockoutExpiresAt": "2025-11-06T11:00:00Z"
    }
  }
}

// 428 - MFA required
{
  "error": {
    "code": "MFA_REQUIRED",
    "message": "Multi-factor authentication required",
    "details": {
      "mfaMethods": ["totp", "sms"]
    }
  }
}
```

### POST /api/v1/auth/refresh
*Template: Document token refresh endpoint*

**Description**: Refresh access token using refresh token

**Request Body**:
```json
{
  "refreshToken": "rt_1234567890abcdef"
}
```

**Success Response (200)**:
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

## Notes Management Endpoints

### GET /api/v1/notes
*Template: Document list endpoint with filtering and pagination*

**Description**: Retrieve user's notes with filtering and pagination

**Query Parameters**:
```typescript
interface NotesListQuery {
  page?: number;          // Default: 1
  limit?: number;         // Default: 20, Max: 100
  search?: string;        // Search in title and content
  folderId?: string;      // Filter by folder
  tags?: string[];        // Filter by tags (comma-separated)
  sortBy?: 'title' | 'createdAt' | 'updatedAt'; // Default: updatedAt
  sortOrder?: 'asc' | 'desc'; // Default: desc
  sharedWithMe?: boolean; // Include notes shared with user
}
```

**Example Request**:
```http
GET /api/v1/notes?page=1&limit=20&search=meeting&tags=work,important&sortBy=updatedAt&sortOrder=desc
```

**Success Response (200)**:
```json
{
  "data": {
    "notes": [
      {
        "id": "note_123456789",
        "title": "Weekly Team Meeting Notes",
        "content": "Meeting agenda and discussion points...",
        "excerpt": "Meeting agenda and discussion points for...",
        "tags": ["work", "meeting", "important"],
        "folderId": "folder_123456789",
        "folderPath": "Work/Meetings",
        "createdBy": {
          "id": "usr_123456789",
          "name": "John Doe",
          "email": "john@company.com"
        },
        "createdAt": "2025-11-06T09:00:00Z",
        "updatedAt": "2025-11-06T10:30:00Z",
        "isShared": true,
        "permissions": {
          "canEdit": true,
          "canShare": true,
          "canDelete": true
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### POST /api/v1/notes
*Template: Document create endpoint with validation rules*

**Description**: Create a new note

**Request Body**:
```json
{
  "title": "New Note Title",
  "content": "Note content in markdown format",
  "folderId": "folder_123456789",
  "tags": ["work", "draft"],
  "isPrivate": false
}
```

**Request Schema**:
```typescript
interface NoteCreateRequest {
  title: string;          // Required, 1-500 characters
  content?: string;       // Optional, max 1MB
  folderId?: string;      // Optional, must be valid folder ID
  tags?: string[];        // Optional, max 10 tags, each max 50 chars
  isPrivate?: boolean;    // Optional, default: false
}
```

**Validation Rules**:
- Title: Required, 1-500 characters, no HTML tags
- Content: Optional, maximum 1MB, markdown allowed
- Tags: Maximum 10 tags, each tag maximum 50 characters
- Folder: Must exist and user must have write access

**Success Response (201)**:
```json
{
  "data": {
    "id": "note_123456789",
    "title": "New Note Title",
    "content": "Note content in markdown format",
    "tags": ["work", "draft"],
    "folderId": "folder_123456789",
    "createdBy": {
      "id": "usr_123456789",
      "name": "John Doe"
    },
    "createdAt": "2025-11-06T10:30:00Z",
    "updatedAt": "2025-11-06T10:30:00Z",
    "permissions": {
      "canEdit": true,
      "canShare": true,
      "canDelete": true
    }
  }
}
```

### GET /api/v1/notes/{noteId}
*Template: Document single resource endpoint*

**Description**: Retrieve a specific note by ID

**Path Parameters**:
- `noteId` (string, required): Unique note identifier

**Success Response (200)**:
```json
{
  "data": {
    "id": "note_123456789",
    "title": "Meeting Notes - Q4 Planning",
    "content": "# Q4 Planning Meeting\n\n## Agenda\n- Budget review\n- Team goals",
    "tags": ["planning", "q4", "meeting"],
    "folderId": "folder_123456789",
    "folderPath": "Work/Planning",
    "createdBy": {
      "id": "usr_123456789",
      "name": "John Doe",
      "email": "john@company.com",
      "avatar": "https://cdn.noteshare.com/avatars/usr_123456789.jpg"
    },
    "createdAt": "2025-11-06T09:00:00Z",
    "updatedAt": "2025-11-06T10:30:00Z",
    "version": 5,
    "wordCount": 247,
    "readingTime": 2,
    "isShared": true,
    "sharedWith": [
      {
        "type": "user",
        "id": "usr_987654321",
        "name": "Jane Smith",
        "permission": "edit"
      },
      {
        "type": "team",
        "id": "team_123456789",
        "name": "Product Team",
        "permission": "view"
      }
    ],
    "permissions": {
      "canEdit": true,
      "canShare": true,
      "canDelete": true,
      "canComment": true
    }
  }
}
```

**Error Responses**:
```json
// 404 - Note not found
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "Note not found or you don't have permission to access it"
  }
}

// 403 - Insufficient permissions
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to view this note"
  }
}
```

### PUT /api/v1/notes/{noteId}
*Template: Document update endpoint with optimistic locking*

**Description**: Update an existing note

**Request Body**:
```json
{
  "title": "Updated Note Title",
  "content": "Updated content",
  "tags": ["updated", "work"],
  "folderId": "folder_987654321",
  "version": 5
}
```

**Request Schema**:
```typescript
interface NoteUpdateRequest {
  title?: string;         // Optional, 1-500 characters
  content?: string;       // Optional, max 1MB
  tags?: string[];        // Optional, max 10 tags
  folderId?: string;      // Optional, must be valid folder ID
  version: number;        // Required for optimistic locking
}
```

**Success Response (200)**:
```json
{
  "data": {
    "id": "note_123456789",
    "title": "Updated Note Title",
    "content": "Updated content",
    "tags": ["updated", "work"],
    "version": 6,
    "updatedAt": "2025-11-06T10:45:00Z"
  }
}
```

**Error Responses**:
```json
// 409 - Version conflict
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Note has been modified by another user",
    "details": {
      "currentVersion": 7,
      "providedVersion": 5
    }
  }
}
```

## Sharing and Permissions Endpoints

### POST /api/v1/notes/{noteId}/share
*Template: Document sharing endpoint with permission levels*

**Description**: Share a note with users or teams

**Request Body**:
```json
{
  "shares": [
    {
      "type": "user",
      "id": "usr_987654321",
      "permission": "edit"
    },
    {
      "type": "team",
      "id": "team_123456789",
      "permission": "view"
    }
  ],
  "message": "Please review these meeting notes"
}
```

**Request Schema**:
```typescript
interface ShareNoteRequest {
  shares: Array<{
    type: 'user' | 'team';
    id: string;
    permission: 'view' | 'comment' | 'edit';
  }>;
  message?: string;       // Optional sharing message
  notifyRecipients?: boolean; // Default: true
}
```

**Success Response (200)**:
```json
{
  "data": {
    "noteId": "note_123456789",
    "sharesAdded": 2,
    "sharesUpdated": 0,
    "notifications": {
      "emailsSent": 3,
      "inAppNotifications": 5
    }
  }
}
```

## File Upload Endpoints

### POST /api/v1/files/upload
*Template: Document file upload with presigned URLs*

**Description**: Get presigned URL for file upload

**Request Body**:
```json
{
  "fileName": "document.pdf",
  "fileSize": 2048576,
  "mimeType": "application/pdf",
  "noteId": "note_123456789"
}
```

**Success Response (200)**:
```json
{
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/noteshare-files/...",
    "fileId": "file_123456789",
    "expiresAt": "2025-11-06T11:30:00Z",
    "maxFileSize": 10485760
  }
}
```

## WebSocket API Contracts

### Real-time Collaboration
*Template: Document WebSocket events for real-time features*

**Connection**: `wss://api.noteshare.com/ws`

**Authentication**: Include JWT token in connection query parameter
```
wss://api.noteshare.com/ws?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Events**:

#### Join Note Editing Session
```json
// Client -> Server
{
  "type": "join_note",
  "payload": {
    "noteId": "note_123456789"
  }
}

// Server -> Client (confirmation)
{
  "type": "note_joined",
  "payload": {
    "noteId": "note_123456789",
    "activeUsers": [
      {
        "id": "usr_123456789",
        "name": "John Doe",
        "cursor": { "line": 5, "column": 12 }
      }
    ]
  }
}
```

#### Content Change
```json
// Client -> Server
{
  "type": "content_change",
  "payload": {
    "noteId": "note_123456789",
    "operation": {
      "type": "insert",
      "position": 150,
      "content": "new text",
      "author": "usr_123456789"
    },
    "version": 6
  }
}

// Server -> Other Clients
{
  "type": "content_updated",
  "payload": {
    "noteId": "note_123456789",
    "operation": {
      "type": "insert",
      "position": 150,
      "content": "new text",
      "author": "usr_123456789"
    },
    "version": 7
  }
}
```

## Error Codes Reference

### Standard HTTP Status Codes
*Template: Document all possible error scenarios*

| Status | Code | Description | Common Scenarios |
|--------|------|-------------|------------------|
| 400 | `VALIDATION_ERROR` | Request validation failed | Invalid input data |
| 401 | `UNAUTHORIZED` | Authentication required | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions | User lacks required permissions |
| 404 | `NOT_FOUND` | Resource not found | Note, user, or folder doesn't exist |
| 409 | `CONFLICT` | Resource conflict | Version mismatch, duplicate data |
| 422 | `UNPROCESSABLE_ENTITY` | Business logic error | Invalid state transition |
| 429 | `RATE_LIMITED` | Too many requests | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error | Unexpected server failure |

### Application-Specific Error Codes
```json
{
  "NOTE_NOT_FOUND": "The requested note does not exist or you don't have access",
  "FOLDER_NOT_EMPTY": "Cannot delete folder that contains notes",
  "INVALID_SHARE_PERMISSION": "Invalid permission level for sharing",
  "ORGANIZATION_LIMIT_EXCEEDED": "Organization has reached user limit",
  "FILE_TOO_LARGE": "File size exceeds maximum allowed size",
  "UNSUPPORTED_FILE_TYPE": "File type is not supported"
}
```

## API Testing Examples

### cURL Examples
*Template: Provide practical examples for testing*

```bash
# Login
curl -X POST https://api.noteshare.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "password123",
    "organizationDomain": "company.com"
  }'

# Create note
curl -X POST https://api.noteshare.com/api/v1/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Note",
    "content": "This is a test note",
    "tags": ["test"]
  }'

# Get notes with filtering
curl -X GET "https://api.noteshare.com/api/v1/notes?search=meeting&tags=work&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Postman Collection
*Template: Reference to API testing collection*

A complete Postman collection is available at: `docs/postman/noteshare-api.json`

The collection includes:
- Environment variables for different stages
- Pre-request scripts for authentication
- Test scripts for response validation
- Example requests for all endpoints

---

*Template Note: API contracts should be kept in sync with the actual implementation. Consider using tools like OpenAPI/Swagger to generate documentation from code or vice versa. Regular testing of these contracts ensures they remain accurate and useful for both development and integration purposes.*