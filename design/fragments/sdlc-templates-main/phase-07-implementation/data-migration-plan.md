# Data Migration Plan

**Phase**: 7 - Implementation (aka: Build, Delivery, Engineering Execution, Construction, Maker Sprint)  
**Deliverable Type**: Data Migration Strategy  
**Template Purpose**: Comprehensive plan for database schema changes and data migrations during implementation  
**Last Updated**: November 2025

## Template Purpose

*This document outlines the strategy for managing database schema changes and data migrations throughout the implementation phase. It ensures data integrity, minimizes downtime, and provides rollback procedures for safe deployment of database changes. Use this template to plan and execute database migrations systematically and safely.*

## Migration Strategy Overview

### Migration Principles
*Template: Define core principles for database migrations*

**Zero-Downtime Deployments**
- All migrations must be backward compatible during deployment
- Use blue-green deployment strategy for major schema changes
- Implement feature flags for database-dependent features

**Data Integrity**
- All migrations include data validation steps
- Rollback procedures tested before production deployment
- Backup verification before and after migrations

**Performance Considerations**
- Large table migrations performed during low-traffic periods
- Index creation done online where possible
- Batch processing for data transformations

**Version Control**
- All migrations tracked in version control
- Sequential numbering for migration ordering
- Descriptive naming convention for migration files

### Migration Tools & Framework
*Template: Define the migration technology stack*

**Database Migration Tools**:
- **Knex.js**: Schema migrations and query builder
- **Flyway**: Alternative for complex migration scenarios
- **Custom scripts**: For data transformations and validations

**Deployment Tools**:
- **Docker**: Containerized migration execution
- **Kubernetes Jobs**: Orchestrated migration runs
- **CI/CD Pipeline**: Automated migration deployment

**Monitoring & Validation**:
- **Database monitoring**: Performance impact tracking
- **Data validation**: Automated integrity checks
- **Rollback automation**: Quick recovery procedures

## Schema Migration Plans

### Initial Database Schema
*Template: Document the baseline database structure*

**Migration**: `001_initial_schema.js`
**Description**: Create initial database structure for NoteShare Pro

```sql
-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    role VARCHAR(50) NOT NULL DEFAULT 'editor',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(email, organization_id)
);

-- Folders table
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by UUID NOT NULL REFERENCES users(id),
    path TEXT, -- Materialized path for efficient queries
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    content TEXT,
    folder_id UUID REFERENCES folders(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by UUID NOT NULL REFERENCES users(id),
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note versions table for history tracking
CREATE TABLE note_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note permissions table
CREATE TABLE note_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('view', 'comment', 'edit', 'admin')),
    granted_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, organization_id)
);

-- Note tags junction table
CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_notes_organization_id ON notes(organization_id);
CREATE INDEX idx_notes_created_by ON notes(created_by);
CREATE INDEX idx_notes_folder_id ON folders(folder_id);
CREATE INDEX idx_notes_updated_at ON notes(updated_at);
CREATE INDEX idx_note_permissions_note_id ON note_permissions(note_id);
CREATE INDEX idx_note_permissions_user_id ON note_permissions(user_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_path ON folders USING gin(path gin_trgm_ops);

-- Full-text search index
CREATE INDEX idx_notes_search ON notes USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));
```

**Rollback Plan**:
```sql
-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS note_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS note_permissions;
DROP TABLE IF EXISTS note_versions;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS folders;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;
```

### Teams and Collaboration Enhancement
*Template: Document feature-specific schema changes*

**Migration**: `002_add_teams_support.js`
**Description**: Add teams functionality for better collaboration

```sql
-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members junction table
CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    added_by UUID NOT NULL REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- Add team_id column to note_permissions (already exists in initial schema)
-- This migration ensures the foreign key constraint is properly set
ALTER TABLE note_permissions 
ADD CONSTRAINT fk_note_permissions_team_id 
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
```

**Data Migration Steps**:
1. Create teams table and related structures
2. Create default "Everyone" team for each organization
3. Add all existing users to their organization's "Everyone" team
4. Update existing note permissions to reference teams where appropriate

**Validation Queries**:
```sql
-- Verify all organizations have an "Everyone" team
SELECT o.id, o.name, t.name as team_name
FROM organizations o
LEFT JOIN teams t ON o.id = t.organization_id AND t.name = 'Everyone'
WHERE t.id IS NULL;

-- Verify all users are members of at least one team
SELECT u.id, u.email, COUNT(tm.team_id) as team_count
FROM users u
LEFT JOIN team_members tm ON u.id = tm.user_id
GROUP BY u.id, u.email
HAVING COUNT(tm.team_id) = 0;
```

**Rollback Plan**:
```sql
-- Remove foreign key constraint
ALTER TABLE note_permissions DROP CONSTRAINT IF EXISTS fk_note_permissions_team_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
```

### File Attachments Support
*Template: Document file handling schema changes*

**Migration**: `003_add_file_attachments.js`
**Description**: Add support for file attachments in notes

```sql
-- File attachments table
CREATE TABLE file_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 's3',
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File processing status table
CREATE TABLE file_processing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_attachment_id UUID NOT NULL REFERENCES file_attachments(id) ON DELETE CASCADE,
    processing_type VARCHAR(50) NOT NULL, -- thumbnail, virus_scan, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    result_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_file_attachments_note_id ON file_attachments(note_id);
CREATE INDEX idx_file_attachments_uploaded_by ON file_attachments(uploaded_by);
CREATE INDEX idx_file_processing_status_file_id ON file_processing_status(file_attachment_id);
CREATE INDEX idx_file_processing_status_status ON file_processing_status(status);

-- Add constraints
ALTER TABLE file_attachments 
ADD CONSTRAINT chk_file_size_limit 
CHECK (file_size <= 10485760); -- 10MB limit

ALTER TABLE file_processing_status
ADD CONSTRAINT chk_processing_status
CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
```

**Data Migration Steps**:
1. Create file attachments tables
2. No existing data to migrate (new feature)
3. Set up file storage buckets and permissions
4. Configure file processing workflows

**Validation Queries**:
```sql
-- Verify file size constraints
SELECT id, filename, file_size
FROM file_attachments
WHERE file_size > 10485760;

-- Check processing status consistency
SELECT fps.id, fps.status, fps.started_at, fps.completed_at
FROM file_processing_status fps
WHERE (fps.status = 'completed' AND fps.completed_at IS NULL)
   OR (fps.status = 'processing' AND fps.started_at IS NULL);
```

### Performance Optimization Migration
*Template: Document performance-focused schema changes*

**Migration**: `004_performance_optimizations.js`
**Description**: Add indexes and optimize queries for better performance

```sql
-- Add composite indexes for common query patterns
CREATE INDEX idx_notes_org_updated_not_deleted 
ON notes(organization_id, updated_at DESC) 
WHERE is_deleted = false;

CREATE INDEX idx_notes_created_by_updated 
ON notes(created_by, updated_at DESC) 
WHERE is_deleted = false;

CREATE INDEX idx_note_permissions_user_permission 
ON note_permissions(user_id, permission_level);

-- Partial index for active users
CREATE INDEX idx_users_active_org 
ON users(organization_id, email) 
WHERE is_active = true;

-- Add materialized view for note statistics
CREATE MATERIALIZED VIEW note_statistics AS
SELECT 
    n.organization_id,
    COUNT(*) as total_notes,
    COUNT(*) FILTER (WHERE n.created_at >= NOW() - INTERVAL '30 days') as notes_last_30_days,
    COUNT(*) FILTER (WHERE n.updated_at >= NOW() - INTERVAL '7 days') as notes_last_7_days,
    AVG(LENGTH(n.content)) as avg_content_length
FROM notes n
WHERE n.is_deleted = false
GROUP BY n.organization_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_note_statistics_org_id 
ON note_statistics(organization_id);

-- Add function to refresh statistics
CREATE OR REPLACE FUNCTION refresh_note_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY note_statistics;
END;
$$ LANGUAGE plpgsql;
```

**Performance Impact Assessment**:
- Index creation time: Estimated 2-5 minutes for large tables
- Storage overhead: Approximately 15% increase in database size
- Query performance improvement: 50-80% faster for common queries

**Rollback Plan**:
```sql
-- Drop materialized view and function
DROP FUNCTION IF EXISTS refresh_note_statistics();
DROP MATERIALIZED VIEW IF EXISTS note_statistics;

-- Drop performance indexes
DROP INDEX IF EXISTS idx_notes_org_updated_not_deleted;
DROP INDEX IF EXISTS idx_notes_created_by_updated;
DROP INDEX IF EXISTS idx_note_permissions_user_permission;
DROP INDEX IF EXISTS idx_users_active_org;
```

## Data Migration Procedures

### Large Table Migration Strategy
*Template: Define approach for migrating large datasets*

**Scenario**: Migrating 10M+ notes with content transformation

**Batch Processing Approach**:
```javascript
// Migration script: 005_transform_note_content.js
const BATCH_SIZE = 1000;

async function migrateNoteContent() {
    let offset = 0;
    let processedCount = 0;
    
    while (true) {
        const notes = await knex('notes')
            .select('id', 'content')
            .where('content_migrated', false)
            .limit(BATCH_SIZE)
            .offset(offset);
            
        if (notes.length === 0) break;
        
        const updates = notes.map(note => ({
            id: note.id,
            transformed_content: transformContent(note.content),
            content_migrated: true
        }));
        
        await knex.transaction(async (trx) => {
            for (const update of updates) {
                await trx('notes')
                    .where('id', update.id)
                    .update({
                        content: update.transformed_content,
                        content_migrated: update.content_migrated
                    });
            }
        });
        
        processedCount += notes.length;
        console.log(`Processed ${processedCount} notes`);
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

function transformContent(content) {
    // Example: Convert old markdown format to new format
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
```

**Progress Tracking**:
```sql
-- Add migration tracking columns
ALTER TABLE notes ADD COLUMN content_migrated BOOLEAN DEFAULT false;

-- Create progress tracking view
CREATE VIEW migration_progress AS
SELECT 
    COUNT(*) as total_notes,
    COUNT(*) FILTER (WHERE content_migrated = true) as migrated_notes,
    ROUND(
        (COUNT(*) FILTER (WHERE content_migrated = true) * 100.0) / COUNT(*), 
        2
    ) as progress_percentage
FROM notes;
```

### Zero-Downtime Migration Example
*Template: Document backward-compatible migration approach*

**Scenario**: Adding new required column to users table

**Phase 1: Add nullable column**
```sql
-- Migration: 006_add_user_timezone_phase1.js
ALTER TABLE users ADD COLUMN timezone VARCHAR(50);
CREATE INDEX idx_users_timezone ON users(timezone);
```

**Phase 2: Populate default values**
```sql
-- Migration: 007_add_user_timezone_phase2.js
UPDATE users 
SET timezone = 'UTC' 
WHERE timezone IS NULL;
```

**Phase 3: Make column required**
```sql
-- Migration: 008_add_user_timezone_phase3.js
ALTER TABLE users 
ALTER COLUMN timezone SET NOT NULL,
ALTER COLUMN timezone SET DEFAULT 'UTC';
```

**Application Code Changes**:
- Phase 1: Application handles NULL timezone values
- Phase 2: Application starts setting timezone for new users
- Phase 3: Application assumes timezone is always present

### Data Validation and Integrity Checks
*Template: Define validation procedures for migrations*

**Pre-Migration Validation**:
```sql
-- Check for data inconsistencies before migration
SELECT 'Orphaned notes' as issue, COUNT(*) as count
FROM notes n
LEFT JOIN users u ON n.created_by = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'Notes without organization' as issue, COUNT(*) as count
FROM notes n
LEFT JOIN organizations o ON n.organization_id = o.id
WHERE o.id IS NULL

UNION ALL

SELECT 'Invalid permissions' as issue, COUNT(*) as count
FROM note_permissions np
WHERE np.user_id IS NULL AND np.team_id IS NULL;
```

**Post-Migration Validation**:
```sql
-- Verify migration completed successfully
SELECT 
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name IN ('users', 'notes', 'organizations')
ORDER BY table_name, ordinal_position;

-- Check data integrity after migration
SELECT 
    'Total users' as metric, 
    COUNT(*) as value 
FROM users
WHERE is_active = true

UNION ALL

SELECT 
    'Total notes' as metric, 
    COUNT(*) as value 
FROM notes
WHERE is_deleted = false

UNION ALL

SELECT 
    'Total permissions' as metric, 
    COUNT(*) as value 
FROM note_permissions;
```

## Migration Execution Plan

### Development Environment
*Template: Define development migration workflow*

**Local Development**:
1. Create migration file with descriptive name
2. Test migration on local database copy
3. Write rollback script and test it
4. Validate data integrity after migration
5. Commit migration to version control

**Development Database Reset**:
```bash
# Reset development database
npm run db:reset

# Run all migrations
npm run db:migrate

# Seed with test data
npm run db:seed
```

### Staging Environment
*Template: Define staging migration procedures*

**Staging Deployment**:
1. Deploy application code with backward compatibility
2. Run migrations during maintenance window
3. Validate migration success with automated tests
4. Perform manual smoke tests
5. Monitor application performance

**Staging Validation Script**:
```bash
#!/bin/bash
# validate-migration.sh

echo "Running migration validation..."

# Check database connectivity
npm run db:check-connection

# Validate schema changes
npm run db:validate-schema

# Run integration tests
npm run test:integration

# Check application health
curl -f http://staging.noteshare.com/health

echo "Migration validation complete"
```

### Production Environment
*Template: Define production migration procedures*

**Production Deployment Checklist**:
- [ ] Database backup completed and verified
- [ ] Migration tested in staging environment
- [ ] Rollback procedure documented and tested
- [ ] Maintenance window scheduled and communicated
- [ ] Monitoring alerts configured
- [ ] Team members on standby for issues

**Production Migration Script**:
```bash
#!/bin/bash
# production-migration.sh

set -e  # Exit on any error

echo "Starting production migration..."

# Create database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run db:migrate

# Validate migration
npm run db:validate

# Run health checks
npm run health-check

echo "Production migration completed successfully"
```

**Rollback Procedure**:
```bash
#!/bin/bash
# rollback-migration.sh

set -e

echo "Starting migration rollback..."

# Stop application
kubectl scale deployment noteshare-api --replicas=0

# Restore database from backup
psql $DATABASE_URL < backup_20251106_143000.sql

# Deploy previous application version
kubectl set image deployment/noteshare-api api=noteshare:v1.2.3

# Scale application back up
kubectl scale deployment noteshare-api --replicas=3

echo "Rollback completed"
```

## Monitoring and Alerting

### Migration Monitoring
*Template: Define monitoring during migrations*

**Key Metrics to Monitor**:
- Database connection count
- Query execution time
- Lock wait time
- Disk space usage
- Application error rate
- Response time degradation

**Alerting Rules**:
```yaml
# migration-alerts.yml
groups:
  - name: migration-alerts
    rules:
      - alert: LongRunningMigration
        expr: migration_duration_seconds > 1800  # 30 minutes
        labels:
          severity: warning
        annotations:
          summary: "Database migration running longer than expected"
          
      - alert: MigrationFailed
        expr: migration_status != "success"
        labels:
          severity: critical
        annotations:
          summary: "Database migration failed"
          
      - alert: HighDatabaseConnections
        expr: postgres_connections > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connection count during migration"
```

### Post-Migration Monitoring
*Template: Define ongoing monitoring after migrations*

**Performance Monitoring**:
```sql
-- Monitor query performance after migration
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE query LIKE '%notes%'
ORDER BY total_time DESC
LIMIT 10;

-- Monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

*Template Note: Data migration plans should be thoroughly tested in non-production environments before execution. Always maintain comprehensive backups and have tested rollback procedures ready. Consider the impact on application performance and user experience when planning migration timing and approach.*