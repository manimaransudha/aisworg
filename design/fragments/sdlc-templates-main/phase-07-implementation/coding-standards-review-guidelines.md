# Coding Standards & Review Guidelines

**Phase**: 7 - Implementation (aka: Build, Delivery, Engineering Execution, Construction, Maker Sprint)  
**Deliverable Type**: Development Standards  
**Template Purpose**: Establish coding standards and code review processes for consistent, maintainable code  
**Last Updated**: November 2025

## Template Purpose

*This document establishes coding standards, best practices, and code review guidelines for the development team. It ensures consistency across the codebase, improves code quality, and facilitates knowledge sharing among team members. Use this template to define your organization's specific coding standards and adapt the guidelines to your technology stack and team preferences.*

## General Coding Principles

### Code Quality Standards
*Template: Define overarching principles that guide all development work*

**Readability First**
- Code should be self-documenting and easy to understand
- Use descriptive variable and function names
- Prefer explicit code over clever shortcuts
- Write code as if the person maintaining it is a violent psychopath who knows where you live

**SOLID Principles**
- **Single Responsibility**: Each class/function should have one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Derived classes must be substitutable for base classes
- **Interface Segregation**: Clients shouldn't depend on interfaces they don't use
- **Dependency Inversion**: Depend on abstractions, not concretions

**DRY (Don't Repeat Yourself)**
- Eliminate code duplication through abstraction
- Create reusable functions and components
- Use configuration files for repeated values

## Language-Specific Standards

### TypeScript/JavaScript Standards
*Template: Adapt these standards to your primary programming language*

#### Naming Conventions
```typescript
// Variables and functions: camelCase
const userName = 'john_doe';
const calculateTotalPrice = (items: Item[]) => { ... };

// Classes: PascalCase
class UserService { ... }
class NoteRepository { ... }

// Constants: SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const API_BASE_URL = 'https://api.noteshare.com';

// Interfaces: PascalCase with 'I' prefix (optional)
interface IUserRepository { ... }
interface NoteCreateRequest { ... }

// Enums: PascalCase
enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer'
}
```

#### Function Guidelines
```typescript
// Use arrow functions for short, simple functions
const isValidEmail = (email: string): boolean => 
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Use regular functions for complex logic
function processNoteContent(content: string, options: ProcessingOptions): ProcessedContent {
  // Complex processing logic here
  const sanitized = sanitizeContent(content);
  const formatted = formatContent(sanitized, options);
  return {
    content: formatted,
    wordCount: countWords(formatted),
    readingTime: calculateReadingTime(formatted)
  };
}

// Always specify return types for public functions
export function createNote(data: NoteCreateRequest): Promise<Note> {
  return noteRepository.create(data);
}
```

#### Error Handling
```typescript
// Use custom error classes
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Handle errors explicitly
async function updateNote(id: string, data: NoteUpdateRequest): Promise<Note> {
  try {
    const note = await noteRepository.findById(id);
    if (!note) {
      throw new NotFoundError(`Note with id ${id} not found`);
    }
    
    const validatedData = validateNoteData(data);
    return await noteRepository.update(id, validatedData);
  } catch (error) {
    logger.error('Failed to update note', { id, error: error.message });
    throw error;
  }
}
```

### Database Standards
*Template: Define standards for database interactions and schema design*

#### Query Guidelines
```typescript
// Use parameterized queries to prevent SQL injection
const getUserNotes = async (userId: string, limit: number = 10): Promise<Note[]> => {
  const query = `
    SELECT n.*, u.name as author_name 
    FROM notes n 
    JOIN users u ON n.created_by = u.id 
    WHERE n.created_by = $1 
    AND n.is_deleted = false 
    ORDER BY n.updated_at DESC 
    LIMIT $2
  `;
  return db.query(query, [userId, limit]);
};

// Use transactions for multi-step operations
const shareNoteWithTeam = async (noteId: string, teamId: string, permission: string): Promise<void> => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Remove existing permissions
    await client.query(
      'DELETE FROM note_permissions WHERE note_id = $1 AND team_id = $2',
      [noteId, teamId]
    );
    
    // Add new permission
    await client.query(
      'INSERT INTO note_permissions (note_id, team_id, permission_level) VALUES ($1, $2, $3)',
      [noteId, teamId, permission]
    );
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

## Code Organization

### Project Structure
*Template: Define how code should be organized within the project*

```
src/
├── controllers/          # HTTP request handlers
│   ├── auth.controller.ts
│   ├── notes.controller.ts
│   └── users.controller.ts
├── services/            # Business logic layer
│   ├── auth.service.ts
│   ├── notes.service.ts
│   └── email.service.ts
├── repositories/        # Data access layer
│   ├── base.repository.ts
│   ├── notes.repository.ts
│   └── users.repository.ts
├── models/             # Data models and types
│   ├── note.model.ts
│   ├── user.model.ts
│   └── index.ts
├── middleware/         # Express middleware
│   ├── auth.middleware.ts
│   ├── validation.middleware.ts
│   └── error.middleware.ts
├── utils/              # Utility functions
│   ├── logger.ts
│   ├── validation.ts
│   └── crypto.ts
├── config/             # Configuration files
│   ├── database.ts
│   ├── redis.ts
│   └── app.ts
└── tests/              # Test files
    ├── unit/
    ├── integration/
    └── fixtures/
```

### Import Guidelines
```typescript
// Group imports: external libraries, internal modules, relative imports
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { UserService } from '../services/user.service';
import { logger } from '../utils/logger';

import { validateRequest } from './validation.middleware';
```

## Documentation Standards

### Code Comments
*Template: Define when and how to write code comments*

```typescript
/**
 * Calculates the reading time for a given text content
 * Based on average reading speed of 200 words per minute
 * 
 * @param content - The text content to analyze
 * @param wordsPerMinute - Reading speed (default: 200)
 * @returns Reading time in minutes, rounded up
 */
function calculateReadingTime(content: string, wordsPerMinute: number = 200): number {
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

// Explain complex business logic
function calculateSubscriptionPrice(users: number, features: string[]): number {
  // Base price is $5 per user per month
  const basePrice = users * 5;
  
  // Premium features add 50% to base price
  const hasPremiumFeatures = features.some(f => PREMIUM_FEATURES.includes(f));
  const premiumMultiplier = hasPremiumFeatures ? 1.5 : 1;
  
  // Volume discounts for large organizations
  const volumeDiscount = users > 100 ? 0.9 : 1; // 10% discount for 100+ users
  
  return Math.round(basePrice * premiumMultiplier * volumeDiscount);
}
```

### API Documentation
```typescript
/**
 * @swagger
 * /api/v1/notes:
 *   post:
 *     summary: Create a new note
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NoteCreateRequest'
 *     responses:
 *       201:
 *         description: Note created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Note'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
export const createNote = async (req: Request, res: Response): Promise<void> => {
  // Implementation here
};
```

## Testing Standards

### Unit Testing Guidelines
*Template: Define testing standards and practices*

```typescript
// Test file naming: [filename].test.ts or [filename].spec.ts
// tests/unit/services/notes.service.test.ts

describe('NotesService', () => {
  let notesService: NotesService;
  let mockRepository: jest.Mocked<NotesRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    notesService = new NotesService(mockRepository);
  });

  describe('createNote', () => {
    it('should create a note with valid data', async () => {
      // Arrange
      const noteData = {
        title: 'Test Note',
        content: 'This is a test note',
        organizationId: 'org-123'
      };
      const expectedNote = { id: 'note-123', ...noteData };
      mockRepository.create.mockResolvedValue(expectedNote);

      // Act
      const result = await notesService.createNote(noteData);

      // Assert
      expect(result).toEqual(expectedNote);
      expect(mockRepository.create).toHaveBeenCalledWith(noteData);
    });

    it('should throw ValidationError for invalid data', async () => {
      // Arrange
      const invalidData = { title: '', content: 'content' };

      // Act & Assert
      await expect(notesService.createNote(invalidData))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Testing
```typescript
// tests/integration/notes.api.test.ts
describe('Notes API', () => {
  let app: Application;
  let testUser: User;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /api/v1/notes', () => {
    it('should create a note for authenticated user', async () => {
      const noteData = {
        title: 'Integration Test Note',
        content: 'This is an integration test'
      };

      const response = await request(app)
        .post('/api/v1/notes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noteData)
        .expect(201);

      expect(response.body).toMatchObject({
        title: noteData.title,
        content: noteData.content,
        createdBy: testUser.id
      });
    });
  });
});
```

## Code Review Guidelines

### Review Checklist
*Template: Create a checklist for code reviewers to ensure consistent reviews*

#### Functionality
- [ ] Code accomplishes the intended functionality
- [ ] Edge cases are handled appropriately
- [ ] Error handling is comprehensive and appropriate
- [ ] Business logic is correct and follows requirements

#### Code Quality
- [ ] Code follows established naming conventions
- [ ] Functions are focused and have single responsibility
- [ ] Code is DRY (no unnecessary duplication)
- [ ] Complex logic is well-commented

#### Security
- [ ] Input validation is implemented where needed
- [ ] SQL injection prevention (parameterized queries)
- [ ] Authentication and authorization checks are in place
- [ ] Sensitive data is not logged or exposed

#### Performance
- [ ] Database queries are optimized
- [ ] No obvious performance bottlenecks
- [ ] Appropriate use of caching where beneficial
- [ ] Memory leaks are avoided

#### Testing
- [ ] Unit tests cover the main functionality
- [ ] Integration tests cover API endpoints
- [ ] Test cases include both positive and negative scenarios
- [ ] Tests are maintainable and not brittle

### Review Process
*Template: Define the code review workflow*

1. **Author Preparation**
   - Self-review code before submitting
   - Write clear pull request description
   - Include testing instructions
   - Link to relevant tickets/requirements

2. **Reviewer Assignment**
   - At least one senior developer review required
   - Domain expert review for complex business logic
   - Security review for authentication/authorization changes

3. **Review Standards**
   - Provide constructive feedback with explanations
   - Suggest improvements, don't just point out problems
   - Approve only when confident in code quality
   - Request changes for significant issues

4. **Response to Feedback**
   - Address all reviewer comments
   - Explain decisions when disagreeing with feedback
   - Re-request review after making changes

### Review Comments Examples
*Template: Provide examples of good review feedback*

```typescript
// Good: Specific and constructive
"Consider extracting this validation logic into a separate function for reusability. 
The same validation pattern is used in createUser() and updateUser()."

// Good: Explains the reasoning
"This query could cause performance issues with large datasets. 
Consider adding pagination or limiting the result set."

// Avoid: Vague or unconstructive
"This doesn't look right."
"Bad code."
```

## Continuous Integration Standards

### Pre-commit Hooks
*Template: Define automated checks that run before code is committed*

```json
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting
npm run lint

# Run type checking
npm run type-check

# Run unit tests
npm run test:unit

# Check formatting
npm run format:check
```

### CI Pipeline Requirements
*Template: Define what checks must pass in CI*

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Code coverage meets minimum threshold (80%)
- [ ] Linting passes with no errors
- [ ] Type checking passes
- [ ] Security vulnerability scan passes
- [ ] Build succeeds for all target environments

---

*Template Note: These coding standards should be living documents that evolve with the team and project needs. Regular review and updates ensure the standards remain relevant and helpful. Consider using automated tools (linters, formatters, static analysis) to enforce standards consistently across the team.*