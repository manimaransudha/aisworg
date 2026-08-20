# Unit & Integration Test Plans

**Phase**: 7 - Implementation (aka: Build, Delivery, Engineering Execution, Construction, Maker Sprint)  
**Deliverable Type**: Testing Strategy  
**Template Purpose**: Comprehensive test plans for unit and integration testing during implementation  
**Last Updated**: November 2025

## Template Purpose

*This document outlines the testing strategy, test cases, and implementation approach for unit and integration tests. It ensures comprehensive test coverage of business logic, API endpoints, and system integrations. Use this template to plan your testing approach and maintain consistent testing standards across the development team.*

## Testing Strategy Overview

### Testing Pyramid
*Template: Define the testing approach and coverage targets*

```
    /\
   /  \     E2E Tests (10%)
  /____\    - Critical user journeys
 /      \   - Cross-browser testing
/________\  Integration Tests (30%)
           - API endpoints
           - Database operations
           - External service integrations

Unit Tests (60%)
- Business logic
- Utility functions
- Component behavior
```

### Coverage Targets
- **Unit Tests**: 80% code coverage minimum
- **Integration Tests**: 100% API endpoint coverage
- **Critical Path Coverage**: 95% for core business flows
- **Branch Coverage**: 75% minimum for complex logic

### Testing Tools & Framework
*Template: Define the testing technology stack*

**Unit Testing**:
- **Jest**: JavaScript testing framework
- **Supertest**: HTTP assertion library
- **Sinon**: Mocking and stubbing library
- **Istanbul/nyc**: Code coverage reporting

**Integration Testing**:
- **Jest**: Test runner and assertions
- **Testcontainers**: Database testing with Docker
- **Nock**: HTTP mocking for external APIs
- **Supertest**: API endpoint testing

**Test Data Management**:
- **Factory functions**: Generate test data
- **Database fixtures**: Consistent test datasets
- **Mock services**: External API simulation

## Unit Test Plans

### Service Layer Testing

#### NotesService Unit Tests
*Template: Define comprehensive test cases for business logic*

**Test File**: `tests/unit/services/notes.service.test.ts`

**Test Cases**:

```typescript
describe('NotesService', () => {
  describe('createNote', () => {
    it('should create note with valid data', async () => {
      // Test successful note creation
    });

    it('should validate required fields', async () => {
      // Test validation for title, content
    });

    it('should sanitize HTML content', async () => {
      // Test XSS prevention
    });

    it('should enforce organization permissions', async () => {
      // Test user can only create notes in their org
    });

    it('should handle folder validation', async () => {
      // Test folder exists and user has access
    });

    it('should limit note size', async () => {
      // Test maximum content size enforcement
    });
  });

  describe('updateNote', () => {
    it('should update note with valid permissions', async () => {
      // Test successful update
    });

    it('should enforce version control', async () => {
      // Test optimistic locking
    });

    it('should validate edit permissions', async () => {
      // Test user has edit access
    });

    it('should preserve creation metadata', async () => {
      // Test createdBy and createdAt unchanged
    });

    it('should update modification timestamp', async () => {
      // Test updatedAt is current
    });
  });

  describe('shareNote', () => {
    it('should share note with valid users', async () => {
      // Test successful sharing
    });

    it('should validate share permissions', async () => {
      // Test user can share the note
    });

    it('should prevent sharing with external users', async () => {
      // Test organization boundary enforcement
    });

    it('should handle team sharing', async () => {
      // Test sharing with teams
    });

    it('should send notifications', async () => {
      // Test notification service integration
    });
  });

  describe('deleteNote', () => {
    it('should soft delete note', async () => {
      // Test note marked as deleted
    });

    it('should validate delete permissions', async () => {
      // Test user has delete access
    });

    it('should handle shared note deletion', async () => {
      // Test impact on shared users
    });
  });
});
```

#### AuthService Unit Tests
*Template: Define authentication and authorization test cases*

**Test File**: `tests/unit/services/auth.service.test.ts`

**Test Cases**:

```typescript
describe('AuthService', () => {
  describe('authenticateUser', () => {
    it('should authenticate with valid credentials', async () => {
      // Test successful login
    });

    it('should reject invalid credentials', async () => {
      // Test failed login
    });

    it('should handle account lockout', async () => {
      // Test multiple failed attempts
    });

    it('should validate MFA when required', async () => {
      // Test two-factor authentication
    });

    it('should integrate with SSO providers', async () => {
      // Test OAuth/SAML integration
    });
  });

  describe('generateTokens', () => {
    it('should generate valid JWT tokens', async () => {
      // Test token structure and claims
    });

    it('should set appropriate expiration', async () => {
      // Test token expiry
    });

    it('should include user permissions', async () => {
      // Test permission claims
    });
  });

  describe('validatePermissions', () => {
    it('should validate note access permissions', async () => {
      // Test permission checking
    });

    it('should handle role-based permissions', async () => {
      // Test role hierarchy
    });

    it('should validate organization boundaries', async () => {
      // Test cross-org access prevention
    });
  });
});
```

### Repository Layer Testing

#### NotesRepository Unit Tests
*Template: Define data access layer test cases*

**Test File**: `tests/unit/repositories/notes.repository.test.ts`

**Test Cases**:

```typescript
describe('NotesRepository', () => {
  describe('create', () => {
    it('should insert note with generated ID', async () => {
      // Test database insertion
    });

    it('should handle database constraints', async () => {
      // Test foreign key violations
    });

    it('should return created note with metadata', async () => {
      // Test return value structure
    });
  });

  describe('findById', () => {
    it('should return note when found', async () => {
      // Test successful retrieval
    });

    it('should return null when not found', async () => {
      // Test missing note handling
    });

    it('should include related data', async () => {
      // Test joins with users, folders
    });
  });

  describe('findByUser', () => {
    it('should return user notes with pagination', async () => {
      // Test paginated results
    });

    it('should filter by search terms', async () => {
      // Test full-text search
    });

    it('should sort by specified criteria', async () => {
      // Test ordering
    });

    it('should exclude deleted notes', async () => {
      // Test soft delete filtering
    });
  });

  describe('updatePermissions', () => {
    it('should add new permissions', async () => {
      // Test permission insertion
    });

    it('should update existing permissions', async () => {
      // Test permission modification
    });

    it('should remove permissions', async () => {
      // Test permission deletion
    });
  });
});
```

### Utility Function Testing

#### Validation Utils Tests
*Template: Define utility function test cases*

**Test File**: `tests/unit/utils/validation.test.ts`

**Test Cases**:

```typescript
describe('ValidationUtils', () => {
  describe('validateEmail', () => {
    it('should accept valid email formats', () => {
      const validEmails = [
        'user@domain.com',
        'user.name@domain.co.uk',
        'user+tag@domain.org'
      ];
      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain'
      ];
      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('sanitizeContent', () => {
    it('should remove dangerous HTML tags', () => {
      const input = '<script>alert("xss")</script><p>Safe content</p>';
      const result = sanitizeContent(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Safe content</p>');
    });

    it('should preserve safe markdown', () => {
      const input = '# Heading\n\n**Bold text**\n\n- List item';
      const result = sanitizeContent(input);
      expect(result).toBe(input);
    });
  });

  describe('validateNoteData', () => {
    it('should validate required fields', () => {
      expect(() => validateNoteData({})).toThrow('Title is required');
    });

    it('should validate field lengths', () => {
      const longTitle = 'a'.repeat(501);
      expect(() => validateNoteData({ title: longTitle }))
        .toThrow('Title must be less than 500 characters');
    });

    it('should validate tag limits', () => {
      const manyTags = Array(11).fill('tag');
      expect(() => validateNoteData({ title: 'Test', tags: manyTags }))
        .toThrow('Maximum 10 tags allowed');
    });
  });
});
```

## Integration Test Plans

### API Endpoint Testing

#### Notes API Integration Tests
*Template: Define comprehensive API test scenarios*

**Test File**: `tests/integration/notes.api.test.ts`

**Setup**:
```typescript
describe('Notes API Integration', () => {
  let app: Application;
  let testDb: Database;
  let testUser: User;
  let authToken: string;

  beforeAll(async () => {
    // Setup test database
    testDb = await createTestDatabase();
    
    // Create test application
    app = await createTestApp(testDb);
    
    // Create test user and auth token
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  beforeEach(async () => {
    await clearTestData(testDb);
  });
});
```

**Test Cases**:

```typescript
describe('POST /api/v1/notes', () => {
  it('should create note with valid data', async () => {
    const noteData = {
      title: 'Test Note',
      content: 'Test content',
      tags: ['test']
    };

    const response = await request(app)
      .post('/api/v1/notes')
      .set('Authorization', `Bearer ${authToken}`)
      .send(noteData)
      .expect(201);

    expect(response.body.data).toMatchObject({
      title: noteData.title,
      content: noteData.content,
      tags: noteData.tags,
      createdBy: testUser.id
    });

    // Verify database state
    const savedNote = await testDb.notes.findById(response.body.data.id);
    expect(savedNote).toBeTruthy();
  });

  it('should return 400 for invalid data', async () => {
    const invalidData = { title: '' }; // Empty title

    const response = await request(app)
      .post('/api/v1/notes')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidData)
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toContainEqual({
      field: 'title',
      message: 'Title is required'
    });
  });

  it('should return 401 without authentication', async () => {
    const noteData = { title: 'Test Note' };

    await request(app)
      .post('/api/v1/notes')
      .send(noteData)
      .expect(401);
  });

  it('should enforce organization boundaries', async () => {
    const otherOrgUser = await createTestUser({ organizationId: 'other-org' });
    const otherOrgToken = generateAuthToken(otherOrgUser);

    const noteData = { title: 'Test Note' };

    const response = await request(app)
      .post('/api/v1/notes')
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .send(noteData)
      .expect(201);

    // Verify note is not visible to original user
    const listResponse = await request(app)
      .get('/api/v1/notes')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(listResponse.body.data.notes).not.toContainEqual(
      expect.objectContaining({ id: response.body.data.id })
    );
  });
});

describe('GET /api/v1/notes', () => {
  beforeEach(async () => {
    // Create test notes
    await createTestNotes([
      { title: 'Note 1', content: 'Content 1', tags: ['work'] },
      { title: 'Note 2', content: 'Content 2', tags: ['personal'] },
      { title: 'Meeting Notes', content: 'Meeting content', tags: ['work', 'meeting'] }
    ], testUser);
  });

  it('should return paginated notes', async () => {
    const response = await request(app)
      .get('/api/v1/notes?page=1&limit=2')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.notes).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNext: true,
      hasPrev: false
    });
  });

  it('should filter by search term', async () => {
    const response = await request(app)
      .get('/api/v1/notes?search=meeting')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.notes).toHaveLength(1);
    expect(response.body.data.notes[0].title).toBe('Meeting Notes');
  });

  it('should filter by tags', async () => {
    const response = await request(app)
      .get('/api/v1/notes?tags=work')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.notes).toHaveLength(2);
    response.body.data.notes.forEach(note => {
      expect(note.tags).toContain('work');
    });
  });

  it('should sort by specified criteria', async () => {
    const response = await request(app)
      .get('/api/v1/notes?sortBy=title&sortOrder=asc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const titles = response.body.data.notes.map(note => note.title);
    expect(titles).toEqual(['Meeting Notes', 'Note 1', 'Note 2']);
  });
});

describe('PUT /api/v1/notes/:id', () => {
  let testNote: Note;

  beforeEach(async () => {
    testNote = await createTestNote({
      title: 'Original Title',
      content: 'Original content',
      version: 1
    }, testUser);
  });

  it('should update note with valid data', async () => {
    const updateData = {
      title: 'Updated Title',
      content: 'Updated content',
      version: 1
    };

    const response = await request(app)
      .put(`/api/v1/notes/${testNote.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: testNote.id,
      title: updateData.title,
      content: updateData.content,
      version: 2
    });
  });

  it('should return 409 for version conflict', async () => {
    const updateData = {
      title: 'Updated Title',
      version: 0 // Outdated version
    };

    const response = await request(app)
      .put(`/api/v1/notes/${testNote.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(409);

    expect(response.body.error.code).toBe('VERSION_CONFLICT');
  });

  it('should return 403 for insufficient permissions', async () => {
    const otherUser = await createTestUser();
    const otherToken = generateAuthToken(otherUser);

    const updateData = { title: 'Hacked', version: 1 };

    await request(app)
      .put(`/api/v1/notes/${testNote.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send(updateData)
      .expect(403);
  });
});
```

#### Authentication API Integration Tests
*Template: Define authentication flow test cases*

**Test File**: `tests/integration/auth.api.test.ts`

**Test Cases**:

```typescript
describe('Authentication API Integration', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should authenticate with valid credentials', async () => {
      const user = await createTestUser({
        email: 'test@company.com',
        password: 'hashedPassword123'
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@company.com',
          password: 'password123',
          organizationDomain: 'company.com'
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('test@company.com');
    });

    it('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@company.com',
          password: 'wrongpassword',
          organizationDomain: 'company.com'
        })
        .expect(401);
    });

    it('should handle rate limiting', async () => {
      const loginData = {
        email: 'test@company.com',
        password: 'wrongpassword',
        organizationDomain: 'company.com'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send(loginData)
          .expect(401);
      }

      // Next attempt should be rate limited
      await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(429);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh valid token', async () => {
      const user = await createTestUser();
      const refreshToken = generateRefreshToken(user);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('expiresIn');
    });

    it('should reject invalid refresh token', async () => {
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });
});
```

### Database Integration Testing

#### Database Operations Tests
*Template: Define database-specific test scenarios*

**Test File**: `tests/integration/database.test.ts`

**Test Cases**:

```typescript
describe('Database Integration', () => {
  describe('Transaction handling', () => {
    it('should rollback on error', async () => {
      const noteData = { title: 'Test Note', content: 'Content' };
      
      // Mock repository to throw error during permission creation
      jest.spyOn(permissionsRepository, 'create')
        .mockRejectedValue(new Error('Database error'));

      await expect(notesService.createNote(noteData, testUser))
        .rejects.toThrow('Database error');

      // Verify note was not created
      const notes = await notesRepository.findByUser(testUser.id);
      expect(notes).toHaveLength(0);
    });

    it('should commit successful transactions', async () => {
      const noteData = { title: 'Test Note', content: 'Content' };
      
      const note = await notesService.createNote(noteData, testUser);

      // Verify both note and permissions were created
      const savedNote = await notesRepository.findById(note.id);
      const permissions = await permissionsRepository.findByNote(note.id);
      
      expect(savedNote).toBeTruthy();
      expect(permissions).toHaveLength(1);
    });
  });

  describe('Concurrent access', () => {
    it('should handle concurrent note updates', async () => {
      const note = await createTestNote({ version: 1 }, testUser);

      // Simulate concurrent updates
      const update1 = notesService.updateNote(note.id, {
        title: 'Update 1',
        version: 1
      }, testUser);

      const update2 = notesService.updateNote(note.id, {
        title: 'Update 2',
        version: 1
      }, testUser);

      // One should succeed, one should fail with version conflict
      const results = await Promise.allSettled([update1, update2]);
      
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
    });
  });

  describe('Data integrity', () => {
    it('should enforce foreign key constraints', async () => {
      await expect(notesRepository.create({
        title: 'Test Note',
        createdBy: 'non-existent-user-id',
        organizationId: testUser.organizationId
      })).rejects.toThrow();
    });

    it('should cascade delete permissions', async () => {
      const note = await createTestNote({}, testUser);
      await shareNote(note.id, [{ userId: 'other-user', permission: 'view' }]);

      await notesRepository.delete(note.id);

      const permissions = await permissionsRepository.findByNote(note.id);
      expect(permissions).toHaveLength(0);
    });
  });
});
```

### External Service Integration Testing

#### Email Service Integration Tests
*Template: Define external service integration test cases*

**Test File**: `tests/integration/email.service.test.ts`

**Test Cases**:

```typescript
describe('Email Service Integration', () => {
  beforeEach(() => {
    // Mock external email service
    nock('https://api.sendgrid.com')
      .post('/v3/mail/send')
      .reply(202, { message: 'success' });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should send sharing notification email', async () => {
    const note = await createTestNote({}, testUser);
    const recipient = await createTestUser({ email: 'recipient@company.com' });

    await notesService.shareNote(note.id, [{
      userId: recipient.id,
      permission: 'view'
    }], testUser);

    // Verify email was sent
    expect(nock.isDone()).toBe(true);
  });

  it('should handle email service failures gracefully', async () => {
    // Mock email service failure
    nock.cleanAll();
    nock('https://api.sendgrid.com')
      .post('/v3/mail/send')
      .reply(500, { error: 'Service unavailable' });

    const note = await createTestNote({}, testUser);
    const recipient = await createTestUser();

    // Sharing should still succeed even if email fails
    await expect(notesService.shareNote(note.id, [{
      userId: recipient.id,
      permission: 'view'
    }], testUser)).resolves.not.toThrow();

    // Verify sharing was completed
    const permissions = await permissionsRepository.findByNote(note.id);
    expect(permissions).toHaveLength(2); // Owner + recipient
  });
});
```

## Test Data Management

### Test Fixtures
*Template: Define reusable test data creation*

**File**: `tests/fixtures/index.ts`

```typescript
export const createTestUser = async (overrides: Partial<User> = {}): Promise<User> => {
  const userData = {
    id: `usr_${Date.now()}_${Math.random()}`,
    email: `test${Date.now()}@company.com`,
    name: 'Test User',
    organizationId: 'test-org-123',
    role: 'editor',
    ...overrides
  };

  return await userRepository.create(userData);
};

export const createTestNote = async (
  overrides: Partial<Note> = {},
  author: User
): Promise<Note> => {
  const noteData = {
    title: 'Test Note',
    content: 'Test content',
    tags: ['test'],
    organizationId: author.organizationId,
    createdBy: author.id,
    ...overrides
  };

  return await notesRepository.create(noteData);
};

export const createTestOrganization = async (
  overrides: Partial<Organization> = {}
): Promise<Organization> => {
  const orgData = {
    id: `org_${Date.now()}`,
    name: 'Test Organization',
    domain: 'testcompany.com',
    ...overrides
  };

  return await organizationRepository.create(orgData);
};
```

### Database Cleanup
*Template: Define test cleanup procedures*

```typescript
export const cleanupTestData = async (): Promise<void> => {
  await db.query('DELETE FROM note_permissions WHERE note_id LIKE $1', ['test_%']);
  await db.query('DELETE FROM notes WHERE id LIKE $1', ['test_%']);
  await db.query('DELETE FROM users WHERE id LIKE $1', ['usr_test_%']);
  await db.query('DELETE FROM organizations WHERE id LIKE $1', ['org_test_%']);
};

export const createTestDatabase = async (): Promise<Database> => {
  const testDb = new Database({
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433'),
    database: `noteshare_test_${Date.now()}`,
    username: process.env.TEST_DB_USER || 'test',
    password: process.env.TEST_DB_PASSWORD || 'test'
  });

  await testDb.migrate();
  return testDb;
};
```

## Test Execution Strategy

### Continuous Integration
*Template: Define CI test execution approach*

**Test Pipeline**:
1. **Lint and Type Check**: Ensure code quality
2. **Unit Tests**: Fast feedback on business logic
3. **Integration Tests**: Verify API contracts and database operations
4. **Coverage Report**: Ensure coverage targets are met
5. **Test Results**: Publish results and artifacts

**Parallel Execution**:
- Unit tests run in parallel by test file
- Integration tests run sequentially to avoid database conflicts
- Use test database per worker for parallel integration tests

### Local Development
*Template: Define local testing workflow*

**Test Commands**:
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- notes.service.test.ts
```

**Pre-commit Hooks**:
- Run unit tests before commit
- Ensure coverage thresholds are met
- Lint and format code

---

*Template Note: Test plans should be updated as new features are implemented and edge cases are discovered. Regular review of test coverage and effectiveness ensures the test suite remains valuable for maintaining code quality and preventing regressions.*