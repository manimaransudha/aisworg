# API Design Specification

**Phase**: 03 - Technical Discovery & Architecture (aka: Solution Architecture, Systems Design, Tech Blueprint, Foundations Sprint)  
**Deliverable Type**: API Contract Definition  
**Template Purpose**: Define REST API endpoints, request/response formats, and integration contracts  
**Last Updated**: November 2024

## Overview

*This document defines the API design for NoteShare Pro, including REST endpoints, authentication, data models, and integration patterns. The API follows RESTful principles and provides comprehensive functionality for note management, collaboration, and organizational features.*

### API Design Principles
- **RESTful Design**: Standard HTTP methods and status codes
- **Consistent Naming**: Clear, predictable endpoint naming conventions
- **Versioning Strategy**: URL-based versioning for backward compatibility
- **Security First**: Authentication and authorization on all endpoints
- **Error Handling**: Standardized error responses with helpful messages
- **Rate Limiting**: Protection against abuse and resource exhaustion

### Base URL Structure
```
Production: https://api.noteshare.pro/v1
Staging: https://api-staging.noteshare.pro/v1
Development: https://api-dev.noteshare.pro/v1
```

## Authentication & Authorization

*Define how clients authenticate with the API and how permissions are managed.*

### Authentication Methods
- **JWT Bearer Tokens**: Primary authentication method
- **API Keys**: For service-to-service communication
- **OAuth 2.0**: For third-party integrations

### Authentication Flow
```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "securepassword"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### Authorization Header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Data Models

*Define the core data structures used throughout the API.*

### User Model
```json
{
  "id": "uuid",
  "email": "string",
  "first_name": "string",
  "last_name": "string",
  "organization_id": "uuid",
  "role": "admin|member|viewer",
  "avatar_url": "string|null",
  "created_at": "ISO8601 datetime",
  "updated_at": "ISO8601 datetime",
  "last_login": "ISO8601 datetime|null"
}
```

### Note Model
```json
{
  "id": "uuid",
  "title": "string",
  "content": "string",
  "content_type": "markdown|html|plain",
  "author_id": "uuid",
  "organization_id": "uuid",
  "folder_id": "uuid|null",
  "tags": ["string"],
  "is_public": "boolean",
  "is_archived": "boolean",
  "version": "integer",
  "created_at": "ISO8601 datetime",
  "updated_at": "ISO8601 datetime",
  "collaborators": ["uuid"],
  "attachments": ["attachment_object"]
}
```

### Organization Model
```json
{
  "id": "uuid",
  "name": "string",
  "domain": "string",
  "plan": "starter|professional|enterprise",
  "settings": {
    "allow_public_sharing": "boolean",
    "require_2fa": "boolean",
    "max_file_size_mb": "integer"
  },
  "created_at": "ISO8601 datetime",
  "updated_at": "ISO8601 datetime"
}
```

## Core API Endpoints

*Define the main REST endpoints for the application functionality.*

### Authentication Endpoints

#### Login
```http
POST /v1/auth/login
Content-Type: application/json

Request:
{
  "email": "user@company.com",
  "password": "securepassword"
}

Response: 200 OK
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": 3600,
  "user": { /* User object */ }
}

Errors:
401 Unauthorized - Invalid credentials
429 Too Many Requests - Rate limit exceeded
```

#### Refresh Token
```http
POST /v1/auth/refresh
Content-Type: application/json

Request:
{
  "refresh_token": "string"
}

Response: 200 OK
{
  "access_token": "string",
  "expires_in": 3600
}
```

#### Logout
```http
POST /v1/auth/logout
Authorization: Bearer {token}

Response: 204 No Content
```

### User Management Endpoints

#### Get Current User
```http
GET /v1/users/me
Authorization: Bearer {token}

Response: 200 OK
{
  "id": "uuid",
  "email": "user@company.com",
  "first_name": "John",
  "last_name": "Doe",
  "organization_id": "uuid",
  "role": "member"
}
```

#### Update User Profile
```http
PUT /v1/users/me
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "first_name": "John",
  "last_name": "Doe",
  "avatar_url": "https://example.com/avatar.jpg"
}

Response: 200 OK
{ /* Updated user object */ }
```

### Notes Management Endpoints

#### List Notes
```http
GET /v1/notes?page=1&limit=20&folder_id=uuid&tags=work,project&search=query
Authorization: Bearer {token}

Response: 200 OK
{
  "data": [
    { /* Note objects */ }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}

Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 20, max: 100)
- folder_id: Filter by folder
- tags: Comma-separated tag list
- search: Full-text search query
- author_id: Filter by author
- is_archived: Filter archived notes
```

#### Create Note
```http
POST /v1/notes
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "title": "Meeting Notes - Q4 Planning",
  "content": "# Q4 Planning Meeting\n\n## Agenda\n- Budget review\n- Team goals",
  "content_type": "markdown",
  "folder_id": "uuid",
  "tags": ["meeting", "planning", "q4"],
  "is_public": false
}

Response: 201 Created
{
  "id": "uuid",
  "title": "Meeting Notes - Q4 Planning",
  "content": "# Q4 Planning Meeting...",
  "author_id": "uuid",
  "created_at": "2024-11-06T10:30:00Z",
  /* ... other note fields */
}
```

#### Get Note
```http
GET /v1/notes/{note_id}
Authorization: Bearer {token}

Response: 200 OK
{ /* Complete note object */ }

Errors:
404 Not Found - Note doesn't exist
403 Forbidden - No access permission
```

#### Update Note
```http
PUT /v1/notes/{note_id}
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "title": "Updated Meeting Notes",
  "content": "Updated content...",
  "tags": ["meeting", "planning", "q4", "updated"]
}

Response: 200 OK
{ /* Updated note object */ }
```

#### Delete Note
```http
DELETE /v1/notes/{note_id}
Authorization: Bearer {token}

Response: 204 No Content

Errors:
404 Not Found - Note doesn't exist
403 Forbidden - No delete permission
```

### Collaboration Endpoints

#### Share Note
```http
POST /v1/notes/{note_id}/share
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "user_ids": ["uuid1", "uuid2"],
  "permission": "read|write|admin",
  "message": "Please review this document"
}

Response: 200 OK
{
  "share_id": "uuid",
  "shared_with": [
    {
      "user_id": "uuid1",
      "permission": "write",
      "shared_at": "2024-11-06T10:30:00Z"
    }
  ]
}
```

#### Get Note Collaborators
```http
GET /v1/notes/{note_id}/collaborators
Authorization: Bearer {token}

Response: 200 OK
{
  "collaborators": [
    {
      "user_id": "uuid",
      "user": { /* User object */ },
      "permission": "write",
      "added_at": "2024-11-06T10:30:00Z"
    }
  ]
}
```

### Search Endpoints

#### Search Notes
```http
GET /v1/search/notes?q=query&filters[tags]=work&filters[author]=uuid
Authorization: Bearer {token}

Response: 200 OK
{
  "query": "meeting notes",
  "results": [
    {
      "note": { /* Note object */ },
      "highlights": {
        "title": ["<mark>meeting</mark> <mark>notes</mark>"],
        "content": ["Important <mark>meeting</mark> decisions..."]
      },
      "score": 0.95
    }
  ],
  "total": 25,
  "took_ms": 45
}
```

### File Upload Endpoints

#### Upload Attachment
```http
POST /v1/notes/{note_id}/attachments
Authorization: Bearer {token}
Content-Type: multipart/form-data

Request:
file: [binary file data]
filename: "document.pdf"
description: "Q4 budget spreadsheet"

Response: 201 Created
{
  "id": "uuid",
  "filename": "document.pdf",
  "size": 1024000,
  "mime_type": "application/pdf",
  "url": "https://files.noteshare.pro/attachments/uuid/document.pdf",
  "uploaded_at": "2024-11-06T10:30:00Z"
}
```

## WebSocket API

*Define real-time collaboration endpoints using WebSocket connections.*

### Connection
```javascript
const socket = io('wss://api.noteshare.pro/collaboration', {
  auth: {
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
```

### Events

#### Join Note Session
```javascript
// Client sends
socket.emit('join_note', {
  note_id: 'uuid',
  user_id: 'uuid'
});

// Server responds
socket.on('joined_note', {
  note_id: 'uuid',
  current_users: [
    {
      user_id: 'uuid',
      user: { /* User object */ },
      cursor_position: 150,
      selection: { start: 100, end: 120 }
    }
  ]
});
```

#### Real-time Editing
```javascript
// Client sends edit operation
socket.emit('edit_operation', {
  note_id: 'uuid',
  operation: {
    type: 'insert',
    position: 150,
    content: 'New text',
    timestamp: 1699267800000
  }
});

// Server broadcasts to other clients
socket.on('operation_applied', {
  note_id: 'uuid',
  operation: { /* Operation object */ },
  author_id: 'uuid'
});
```

#### Cursor Tracking
```javascript
// Client sends cursor position
socket.emit('cursor_update', {
  note_id: 'uuid',
  position: 200,
  selection: { start: 180, end: 220 }
});

// Server broadcasts to other clients
socket.on('cursor_moved', {
  user_id: 'uuid',
  position: 200,
  selection: { start: 180, end: 220 }
});
```

## Error Handling

*Define standardized error response formats and common error scenarios.*

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request data is invalid",
    "details": [
      {
        "field": "email",
        "message": "Email address is required"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ],
    "request_id": "uuid"
  }
}
```

### HTTP Status Codes
- **200 OK**: Successful GET, PUT requests
- **201 Created**: Successful POST requests
- **204 No Content**: Successful DELETE requests
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate email)
- **422 Unprocessable Entity**: Validation errors
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Common Error Codes
- `AUTHENTICATION_REQUIRED`: Missing or invalid authentication
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `VALIDATION_ERROR`: Request data validation failed
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED`: Too many requests from client
- `ORGANIZATION_LIMIT_REACHED`: Organization plan limits exceeded

## Rate Limiting

*Define API rate limiting policies and headers.*

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1699267800
X-RateLimit-Window: 3600
```

### Rate Limit Policies
- **Authenticated Users**: 1000 requests per hour
- **Unauthenticated**: 100 requests per hour
- **File Uploads**: 50 uploads per hour
- **Search Queries**: 500 searches per hour

## API Versioning

*Define versioning strategy and backward compatibility approach.*

### Versioning Strategy
- **URL Versioning**: `/v1/`, `/v2/` in the URL path
- **Backward Compatibility**: Maintain previous versions for 12 months
- **Deprecation Notice**: 6-month notice before version retirement
- **Version Headers**: Optional `API-Version` header support

### Version Lifecycle
1. **Alpha**: Internal testing, breaking changes allowed
2. **Beta**: Public testing, minimal breaking changes
3. **Stable**: Production ready, no breaking changes
4. **Deprecated**: Maintenance only, migration encouraged
5. **Retired**: No longer supported

## Integration Examples

*Provide code examples for common integration scenarios.*

### JavaScript/Node.js Example
```javascript
const axios = require('axios');

class NoteShareAPI {
  constructor(baseURL, accessToken) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createNote(noteData) {
    try {
      const response = await this.client.post('/notes', noteData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create note: ${error.response.data.error.message}`);
    }
  }

  async searchNotes(query, filters = {}) {
    const params = new URLSearchParams({ q: query, ...filters });
    const response = await this.client.get(`/search/notes?${params}`);
    return response.data;
  }
}

// Usage
const api = new NoteShareAPI('https://api.noteshare.pro/v1', 'your-access-token');
const note = await api.createNote({
  title: 'API Integration Test',
  content: 'Testing the NoteShare API integration',
  tags: ['api', 'test']
});
```

### Python Example
```python
import requests
from typing import Dict, List, Optional

class NoteShareAPI:
    def __init__(self, base_url: str, access_token: str):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
    
    def create_note(self, note_data: Dict) -> Dict:
        response = requests.post(
            f'{self.base_url}/notes',
            json=note_data,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def search_notes(self, query: str, filters: Optional[Dict] = None) -> Dict:
        params = {'q': query}
        if filters:
            params.update(filters)
        
        response = requests.get(
            f'{self.base_url}/search/notes',
            params=params,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# Usage
api = NoteShareAPI('https://api.noteshare.pro/v1', 'your-access-token')
note = api.create_note({
    'title': 'Python API Test',
    'content': 'Testing the API with Python',
    'tags': ['python', 'api']
})
```

## Testing & Documentation

*Guidelines for API testing and documentation maintenance.*

### API Testing Strategy
- **Unit Tests**: Test individual endpoint logic
- **Integration Tests**: Test API workflows and data flow
- **Contract Tests**: Validate API contracts with consumers
- **Load Tests**: Verify performance under expected load
- **Security Tests**: Test authentication and authorization

### Documentation Tools
- **OpenAPI/Swagger**: Generate interactive API documentation
- **Postman Collections**: Provide ready-to-use API examples
- **SDK Generation**: Auto-generate client libraries
- **Changelog**: Document API changes and deprecations

---

*This API design specification provides a comprehensive foundation for the NoteShare Pro API. Use this template to define your own API by replacing the example endpoints and data models with your specific requirements. Remember to keep the API documentation updated as your system evolves and new features are added.*