# Localization & Internationalization Strategy

**Phase**: 7 - Implementation (aka: Build, Delivery, Engineering Execution, Construction, Maker Sprint)  
**Deliverable Type**: i18n/L10n Implementation Plan  
**Template Purpose**: Comprehensive strategy for implementing internationalization and localization during development  
**Last Updated**: November 2025

## Template Purpose

*This document outlines the technical implementation strategy for internationalization (i18n) and localization (L10n) of NoteShare Pro. It covers code architecture, translation management, cultural adaptations, and technical considerations for supporting multiple languages and regions. Use this template to implement a scalable, maintainable internationalization system from the ground up.*

## Internationalization Overview

### Scope and Requirements
*Template: Define the scope of internationalization efforts*

**Target Markets (Phase 1)**:
- **English (US)**: Primary market - en-US
- **Spanish (Spain)**: European expansion - es-ES  
- **French (France)**: European expansion - fr-FR
- **German (Germany)**: European expansion - de-DE
- **Japanese (Japan)**: Asia-Pacific expansion - ja-JP

**Target Markets (Phase 2)**:
- **Portuguese (Brazil)**: Latin American expansion - pt-BR
- **Chinese Simplified (China)**: Asia-Pacific expansion - zh-CN
- **Korean (South Korea)**: Asia-Pacific expansion - ko-KR
- **Italian (Italy)**: European expansion - it-IT
- **Dutch (Netherlands)**: European expansion - nl-NL

**Internationalization Requirements**:
- Support for left-to-right (LTR) and right-to-left (RTL) languages
- Unicode (UTF-8) support throughout the application
- Locale-specific date, time, and number formatting
- Currency formatting for subscription pricing
- Timezone handling for global users
- Cultural adaptations for colors, imagery, and content

### Technical Architecture
*Template: Define the technical approach to i18n implementation*

**Frontend Architecture**:
- **React-i18next**: Primary internationalization library
- **ICU Message Format**: Advanced message formatting
- **Namespace organization**: Feature-based translation grouping
- **Lazy loading**: Load translations on demand
- **Fallback strategy**: Graceful degradation to default language

**Backend Architecture**:
- **i18next**: Node.js internationalization framework
- **Database localization**: Multilingual content storage
- **API localization**: Localized error messages and responses
- **Email templates**: Localized notification emails
- **Documentation**: Multilingual help content

## Frontend Internationalization Implementation

### React-i18next Setup
*Template: Define frontend i18n configuration*

**Installation and Configuration**:
```bash
npm install react-i18next i18next i18next-browser-languagedetector i18next-http-backend
```

**i18n Configuration** (`src/i18n/index.ts`):
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: 'en-US', // Default language
    fallbackLng: 'en-US',
    debug: process.env.NODE_ENV === 'development',
    
    // Namespace configuration
    ns: ['common', 'auth', 'notes', 'settings', 'errors'],
    defaultNS: 'common',
    
    // Backend configuration
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      addPath: '/locales/add/{{lng}}/{{ns}}',
    },
    
    // Language detection
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes
      formatSeparator: ',',
      format: (value, format, lng) => {
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        if (format === 'currency') return formatCurrency(value, lng);
        if (format === 'date') return formatDate(value, lng);
        return value;
      }
    },
    
    // React options
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    }
  });

export default i18n;
```

### Translation File Structure
*Template: Define translation file organization*

**Directory Structure**:
```
public/locales/
├── en-US/
│   ├── common.json
│   ├── auth.json
│   ├── notes.json
│   ├── settings.json
│   └── errors.json
├── es-ES/
│   ├── common.json
│   ├── auth.json
│   ├── notes.json
│   ├── settings.json
│   └── errors.json
└── [other-locales]/
```

**Common Translations** (`public/locales/en-US/common.json`):
```json
{
  "navigation": {
    "dashboard": "Dashboard",
    "notes": "Notes",
    "folders": "Folders",
    "shared": "Shared with me",
    "settings": "Settings",
    "help": "Help"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "share": "Share",
    "create": "Create",
    "search": "Search",
    "filter": "Filter",
    "sort": "Sort"
  },
  "status": {
    "loading": "Loading...",
    "saving": "Saving...",
    "saved": "Saved",
    "error": "Error occurred",
    "success": "Success"
  },
  "time": {
    "now": "now",
    "minutesAgo": "{{count}} minute ago",
    "minutesAgo_plural": "{{count}} minutes ago",
    "hoursAgo": "{{count}} hour ago",
    "hoursAgo_plural": "{{count}} hours ago",
    "daysAgo": "{{count}} day ago",
    "daysAgo_plural": "{{count}} days ago"
  },
  "formatting": {
    "currency": {
      "monthly": "${{amount}}/month",
      "yearly": "${{amount}}/year",
      "perUser": "per user"
    }
  }
}
```

**Notes Feature Translations** (`public/locales/en-US/notes.json`):
```json
{
  "title": "Notes",
  "create": {
    "title": "Create New Note",
    "titlePlaceholder": "Enter note title...",
    "contentPlaceholder": "Start writing your note...",
    "selectFolder": "Select folder",
    "addTags": "Add tags",
    "createButton": "Create Note"
  },
  "list": {
    "empty": "No notes found",
    "emptySearch": "No notes match your search criteria",
    "searchPlaceholder": "Search notes...",
    "sortBy": "Sort by",
    "sortOptions": {
      "title": "Title",
      "created": "Date Created",
      "updated": "Last Updated"
    }
  },
  "editor": {
    "saving": "Saving...",
    "saved": "All changes saved",
    "offline": "You're offline. Changes will sync when reconnected.",
    "conflictResolution": "This note was modified by {{userName}}. Would you like to:",
    "conflictOptions": {
      "keepYours": "Keep your changes",
      "keepTheirs": "Accept their changes",
      "merge": "Merge changes"
    }
  },
  "sharing": {
    "title": "Share Note",
    "shareWith": "Share with",
    "permissions": {
      "view": "Can view",
      "comment": "Can comment",
      "edit": "Can edit"
    },
    "shareButton": "Share",
    "copyLink": "Copy link",
    "linkCopied": "Link copied to clipboard",
    "notifications": {
      "shared": "Note shared with {{count}} person",
      "shared_plural": "Note shared with {{count}} people"
    }
  }
}
```

### Component Internationalization
*Template: Define how to implement i18n in React components*

**Hook-based Translation**:
```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { enUS, es, fr, de, ja } from 'date-fns/locale';

const localeMap = {
  'en-US': enUS,
  'es-ES': es,
  'fr-FR': fr,
  'de-DE': de,
  'ja-JP': ja
};

interface NoteCardProps {
  note: {
    id: string;
    title: string;
    updatedAt: Date;
    author: string;
    isShared: boolean;
  };
}

export const NoteCard: React.FC<NoteCardProps> = ({ note }) => {
  const { t, i18n } = useTranslation(['notes', 'common']);
  
  const formatRelativeTime = (date: Date) => {
    const locale = localeMap[i18n.language as keyof typeof localeMap] || enUS;
    return formatDistanceToNow(date, { 
      addSuffix: true, 
      locale 
    });
  };

  return (
    <div className="note-card">
      <h3>{note.title}</h3>
      <div className="note-meta">
        <span>
          {t('common:time.updatedBy', { 
            time: formatRelativeTime(note.updatedAt),
            author: note.author 
          })}
        </span>
        {note.isShared && (
          <span className="shared-indicator">
            {t('notes:sharing.shared')}
          </span>
        )}
      </div>
    </div>
  );
};
```

**Form Validation with i18n**:
```typescript
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

export const CreateNoteForm: React.FC = () => {
  const { t } = useTranslation(['notes', 'errors']);
  
  // Localized validation schema
  const schema = yup.object({
    title: yup
      .string()
      .required(t('errors:validation.required', { field: t('notes:create.title') }))
      .max(500, t('errors:validation.maxLength', { field: t('notes:create.title'), max: 500 })),
    content: yup
      .string()
      .max(1000000, t('errors:validation.maxLength', { field: t('notes:create.content'), max: '1MB' })),
    tags: yup
      .array()
      .of(yup.string())
      .max(10, t('errors:validation.maxItems', { field: t('notes:create.tags'), max: 10 }))
  });

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema)
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="form-group">
        <label>{t('notes:create.title')}</label>
        <input
          {...register('title')}
          placeholder={t('notes:create.titlePlaceholder')}
        />
        {errors.title && (
          <span className="error">{errors.title.message}</span>
        )}
      </div>
      
      <div className="form-group">
        <label>{t('notes:create.content')}</label>
        <textarea
          {...register('content')}
          placeholder={t('notes:create.contentPlaceholder')}
        />
        {errors.content && (
          <span className="error">{errors.content.message}</span>
        )}
      </div>
      
      <button type="submit">
        {t('notes:create.createButton')}
      </button>
    </form>
  );
};
```

## Backend Internationalization Implementation

### Node.js i18n Setup
*Template: Define backend i18n configuration*

**Backend Configuration** (`src/i18n/index.ts`):
```typescript
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    preload: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'],
    
    ns: ['common', 'errors', 'emails', 'api'],
    defaultNS: 'common',
    
    backend: {
      loadPath: './locales/{{lng}}/{{ns}}.json',
    },
    
    detection: {
      order: ['header', 'querystring'],
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lng',
      caches: false,
    },
    
    interpolation: {
      escapeValue: false,
    }
  });

export default i18next;
```

**Express Middleware Integration**:
```typescript
import express from 'express';
import i18next from './i18n';
import middleware from 'i18next-http-middleware';

const app = express();

// i18n middleware
app.use(middleware.handle(i18next));

// Localized API responses
app.get('/api/v1/notes', (req, res) => {
  try {
    const notes = getNotes(req.user.id);
    res.json({
      data: notes,
      message: req.t('api:notes.retrieved', { count: notes.length })
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: req.t('errors:server.internal')
      }
    });
  }
});
```

### Database Localization Strategy
*Template: Define multilingual content storage approach*

**Localized Content Schema**:
```sql
-- Localized content table for user-facing strings
CREATE TABLE localized_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_key VARCHAR(255) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    context JSONB, -- Additional context for translators
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(content_key, locale)
);

-- Localized help articles
CREATE TABLE help_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(slug, locale)
);

-- Localized email templates
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(255) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT NOT NULL,
    variables JSONB, -- Template variable definitions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_key, locale)
);

-- Create indexes
CREATE INDEX idx_localized_content_key_locale ON localized_content(content_key, locale);
CREATE INDEX idx_help_articles_locale_category ON help_articles(locale, category);
CREATE INDEX idx_email_templates_key_locale ON email_templates(template_key, locale);
```

**Localized Content Service**:
```typescript
interface LocalizedContentService {
  getContent(key: string, locale: string, fallbackLocale?: string): Promise<string>;
  setContent(key: string, locale: string, content: string): Promise<void>;
  getHelpArticle(slug: string, locale: string): Promise<HelpArticle | null>;
  getEmailTemplate(templateKey: string, locale: string): Promise<EmailTemplate | null>;
}

class DatabaseLocalizedContentService implements LocalizedContentService {
  async getContent(key: string, locale: string, fallbackLocale = 'en-US'): Promise<string> {
    // Try to get content in requested locale
    let content = await db.query(
      'SELECT content FROM localized_content WHERE content_key = $1 AND locale = $2',
      [key, locale]
    );
    
    // Fallback to default locale if not found
    if (!content.rows.length && locale !== fallbackLocale) {
      content = await db.query(
        'SELECT content FROM localized_content WHERE content_key = $1 AND locale = $2',
        [key, fallbackLocale]
      );
    }
    
    return content.rows[0]?.content || key; // Return key as fallback
  }
  
  async getEmailTemplate(templateKey: string, locale: string): Promise<EmailTemplate | null> {
    const result = await db.query(`
      SELECT * FROM email_templates 
      WHERE template_key = $1 AND locale = $2
      UNION ALL
      SELECT * FROM email_templates 
      WHERE template_key = $1 AND locale = 'en-US' AND NOT EXISTS (
        SELECT 1 FROM email_templates 
        WHERE template_key = $1 AND locale = $2
      )
      LIMIT 1
    `, [templateKey, locale]);
    
    return result.rows[0] || null;
  }
}
```

## Cultural Adaptations

### Right-to-Left (RTL) Language Support
*Template: Define RTL language implementation*

**CSS RTL Support**:
```scss
// Base styles with logical properties
.note-card {
  margin-inline-start: 1rem;
  margin-inline-end: 2rem;
  padding-inline: 1rem;
  border-inline-start: 2px solid #ccc;
  text-align: start;
}

// RTL-specific overrides
[dir="rtl"] {
  .note-card {
    // RTL-specific styles if needed
  }
  
  .icon-arrow-right {
    transform: scaleX(-1); // Flip arrow direction
  }
}

// Language-specific font stacks
:lang(ar) {
  font-family: 'Noto Sans Arabic', 'Arial Unicode MS', sans-serif;
}

:lang(he) {
  font-family: 'Noto Sans Hebrew', 'Arial Unicode MS', sans-serif;
}

:lang(ja) {
  font-family: 'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', sans-serif;
}

:lang(zh) {
  font-family: 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
```

**React RTL Component**:
```typescript
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

export const RTLProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  
  useEffect(() => {
    const isRTL = RTL_LANGUAGES.some(lang => i18n.language.startsWith(lang));
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  
  return <>{children}</>;
};
```

### Date, Time, and Number Formatting
*Template: Define locale-specific formatting*

**Formatting Utilities**:
```typescript
import { format, formatDistanceToNow } from 'date-fns';
import { enUS, es, fr, de, ja, zhCN, ko } from 'date-fns/locale';

const localeMap = {
  'en-US': enUS,
  'es-ES': es,
  'fr-FR': fr,
  'de-DE': de,
  'ja-JP': ja,
  'zh-CN': zhCN,
  'ko-KR': ko,
};

export class LocaleFormatter {
  constructor(private locale: string) {}
  
  formatDate(date: Date, formatString = 'PPP'): string {
    const locale = localeMap[this.locale as keyof typeof localeMap] || enUS;
    return format(date, formatString, { locale });
  }
  
  formatRelativeTime(date: Date): string {
    const locale = localeMap[this.locale as keyof typeof localeMap] || enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  }
  
  formatNumber(number: number): string {
    return new Intl.NumberFormat(this.locale).format(number);
  }
  
  formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }
  
  formatFileSize(bytes: number): string {
    const units = this.getFileSizeUnits();
    const threshold = 1024;
    
    if (Math.abs(bytes) < threshold) {
      return `${bytes} ${units.bytes}`;
    }
    
    const unitIndex = Math.floor(Math.log(Math.abs(bytes)) / Math.log(threshold));
    const size = bytes / Math.pow(threshold, unitIndex);
    const unit = [units.bytes, units.kb, units.mb, units.gb][unitIndex];
    
    return `${size.toFixed(1)} ${unit}`;
  }
  
  private getFileSizeUnits() {
    // This would come from translation files
    const units = {
      'en-US': { bytes: 'B', kb: 'KB', mb: 'MB', gb: 'GB' },
      'es-ES': { bytes: 'B', kb: 'KB', mb: 'MB', gb: 'GB' },
      'fr-FR': { bytes: 'o', kb: 'Ko', mb: 'Mo', gb: 'Go' },
      'de-DE': { bytes: 'B', kb: 'KB', mb: 'MB', gb: 'GB' },
      'ja-JP': { bytes: 'B', kb: 'KB', mb: 'MB', gb: 'GB' },
    };
    
    return units[this.locale as keyof typeof units] || units['en-US'];
  }
}
```

## Translation Management Workflow

### Translation File Management
*Template: Define translation workflow and tooling*

**Translation Management Tools**:
- **Crowdin**: Professional translation management platform
- **Lokalise**: Developer-friendly localization platform
- **i18next-scanner**: Extract translatable strings from code
- **GitHub Actions**: Automated translation sync

**Translation Extraction Script**:
```javascript
// scripts/extract-translations.js
const scanner = require('i18next-scanner');
const fs = require('fs');
const path = require('path');

const options = {
  input: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!**/node_modules/**'
  ],
  output: './public/locales',
  options: {
    debug: true,
    func: {
      list: ['t', 'i18next.t', 'i18n.t'],
      extensions: ['.js', '.jsx', '.ts', '.tsx']
    },
    trans: {
      component: 'Trans',
      i18nKey: 'i18nKey',
      defaultsKey: 'defaults',
      extensions: ['.js', '.jsx', '.ts', '.tsx']
    },
    lngs: ['en-US'],
    ns: ['common', 'auth', 'notes', 'settings', 'errors'],
    defaultLng: 'en-US',
    defaultNs: 'common',
    resource: {
      loadPath: '{{lng}}/{{ns}}.json',
      savePath: '{{lng}}/{{ns}}.json',
      jsonIndent: 2,
      lineEnding: '\n'
    }
  }
};

scanner.createStream(options)
  .pipe(fs.createWriteStream('./extracted-translations.json'));
```

**Translation Validation Script**:
```javascript
// scripts/validate-translations.js
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = './public/locales';
const SUPPORTED_LOCALES = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'];
const NAMESPACES = ['common', 'auth', 'notes', 'settings', 'errors'];

function validateTranslations() {
  const issues = [];
  
  // Load base translations (en-US)
  const baseTranslations = {};
  NAMESPACES.forEach(ns => {
    const filePath = path.join(LOCALES_DIR, 'en-US', `${ns}.json`);
    if (fs.existsSync(filePath)) {
      baseTranslations[ns] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  });
  
  // Validate other locales
  SUPPORTED_LOCALES.slice(1).forEach(locale => {
    NAMESPACES.forEach(ns => {
      const filePath = path.join(LOCALES_DIR, locale, `${ns}.json`);
      
      if (!fs.existsSync(filePath)) {
        issues.push(`Missing translation file: ${locale}/${ns}.json`);
        return;
      }
      
      const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const missingKeys = findMissingKeys(baseTranslations[ns], translations, `${locale}/${ns}`);
      issues.push(...missingKeys);
    });
  });
  
  if (issues.length > 0) {
    console.error('Translation validation failed:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    process.exit(1);
  } else {
    console.log('All translations are valid!');
  }
}

function findMissingKeys(base, target, context, prefix = '') {
  const issues = [];
  
  for (const key in base) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (!(key in target)) {
      issues.push(`Missing key in ${context}: ${fullKey}`);
    } else if (typeof base[key] === 'object' && typeof target[key] === 'object') {
      issues.push(...findMissingKeys(base[key], target[key], context, fullKey));
    }
  }
  
  return issues;
}

validateTranslations();
```

### Continuous Localization Pipeline
*Template: Define automated translation workflow*

**GitHub Actions Workflow** (`.github/workflows/translations.yml`):
```yaml
name: Translation Management

on:
  push:
    branches: [main, develop]
    paths: ['src/**', 'public/locales/**']
  pull_request:
    paths: ['src/**', 'public/locales/**']

jobs:
  extract-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Extract translations
        run: npm run i18n:extract
      
      - name: Upload to Crowdin
        if: github.ref == 'refs/heads/main'
        uses: crowdin/github-action@v1
        with:
          upload_sources: true
          upload_translations: false
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
  
  validate-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate translations
        run: npm run i18n:validate
      
      - name: Check translation coverage
        run: npm run i18n:coverage
```

## Testing Internationalization

### i18n Testing Strategy
*Template: Define testing approach for internationalized features*

**Translation Testing**:
```typescript
// tests/i18n/translations.test.ts
import i18n from '../../src/i18n';

describe('Translation Tests', () => {
  beforeAll(async () => {
    await i18n.init();
  });

  describe('English translations', () => {
    beforeEach(() => {
      i18n.changeLanguage('en-US');
    });

    it('should have all required common translations', () => {
      expect(i18n.t('common:navigation.dashboard')).toBe('Dashboard');
      expect(i18n.t('common:actions.save')).toBe('Save');
      expect(i18n.t('common:actions.cancel')).toBe('Cancel');
    });

    it('should handle pluralization correctly', () => {
      expect(i18n.t('common:time.minutesAgo', { count: 1 })).toBe('1 minute ago');
      expect(i18n.t('common:time.minutesAgo', { count: 5 })).toBe('5 minutes ago');
    });

    it('should format interpolated values', () => {
      expect(i18n.t('notes:sharing.notifications.shared', { count: 1 }))
        .toBe('Note shared with 1 person');
      expect(i18n.t('notes:sharing.notifications.shared', { count: 3 }))
        .toBe('Note shared with 3 people');
    });
  });

  describe('Spanish translations', () => {
    beforeEach(() => {
      i18n.changeLanguage('es-ES');
    });

    it('should have Spanish translations', () => {
      expect(i18n.t('common:navigation.dashboard')).toBe('Panel de control');
      expect(i18n.t('common:actions.save')).toBe('Guardar');
      expect(i18n.t('common:actions.cancel')).toBe('Cancelar');
    });

    it('should handle Spanish pluralization', () => {
      expect(i18n.t('common:time.minutesAgo', { count: 1 })).toBe('hace 1 minuto');
      expect(i18n.t('common:time.minutesAgo', { count: 5 })).toBe('hace 5 minutos');
    });
  });

  describe('Fallback behavior', () => {
    it('should fallback to English for missing translations', () => {
      i18n.changeLanguage('fr-FR');
      // Assuming this key doesn't exist in French
      expect(i18n.t('common:nonexistent.key')).toBe('common:nonexistent.key');
    });
  });
});
```

**Component i18n Testing**:
```typescript
// tests/components/NoteCard.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../src/i18n';
import { NoteCard } from '../../src/components/NoteCard';

const mockNote = {
  id: '1',
  title: 'Test Note',
  updatedAt: new Date('2025-11-06T10:00:00Z'),
  author: 'John Doe',
  isShared: true
};

describe('NoteCard i18n', () => {
  const renderWithI18n = (component: React.ReactElement, language = 'en-US') => {
    i18n.changeLanguage(language);
    return render(
      <I18nextProvider i18n={i18n}>
        {component}
      </I18nextProvider>
    );
  };

  it('should display content in English', () => {
    renderWithI18n(<NoteCard note={mockNote} />);
    expect(screen.getByText('Shared')).toBeInTheDocument();
  });

  it('should display content in Spanish', () => {
    renderWithI18n(<NoteCard note={mockNote} />, 'es-ES');
    expect(screen.getByText('Compartido')).toBeInTheDocument();
  });

  it('should format dates according to locale', () => {
    renderWithI18n(<NoteCard note={mockNote} />, 'fr-FR');
    // French date formatting should be different from English
    const dateElement = screen.getByText(/il y a/);
    expect(dateElement).toBeInTheDocument();
  });
});
```

### Pseudo-localization Testing
*Template: Define pseudo-localization for testing*

**Pseudo-locale Generation**:
```typescript
// scripts/generate-pseudo-locale.js
const fs = require('fs');
const path = require('path');

const PSEUDO_CHARS = {
  'a': 'ä', 'e': 'ë', 'i': 'ï', 'o': 'ö', 'u': 'ü',
  'A': 'Ä', 'E': 'Ë', 'I': 'Ï', 'O': 'Ö', 'U': 'Ü',
  'n': 'ñ', 'N': 'Ñ', 'c': 'ç', 'C': 'Ç'
};

function pseudoLocalize(text) {
  // Add brackets to identify translated strings
  let pseudo = `[${text}]`;
  
  // Replace characters with accented versions
  pseudo = pseudo.replace(/[aeiouAEIOUnNcC]/g, char => PSEUDO_CHARS[char] || char);
  
  // Expand text by 30% to test layout with longer text
  const expansion = Math.ceil(text.length * 0.3);
  pseudo += ' ' + 'x'.repeat(expansion);
  
  return pseudo;
}

function generatePseudoLocale() {
  const enUSPath = './public/locales/en-US';
  const pseudoPath = './public/locales/pseudo';
  
  if (!fs.existsSync(pseudoPath)) {
    fs.mkdirSync(pseudoPath, { recursive: true });
  }
  
  const files = fs.readdirSync(enUSPath);
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const enContent = JSON.parse(fs.readFileSync(path.join(enUSPath, file), 'utf8'));
      const pseudoContent = transformObject(enContent, pseudoLocalize);
      
      fs.writeFileSync(
        path.join(pseudoPath, file),
        JSON.stringify(pseudoContent, null, 2)
      );
    }
  });
  
  console.log('Pseudo-locale generated successfully!');
}

function transformObject(obj, transformer) {
  const result = {};
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      result[key] = transformer(obj[key]);
    } else if (typeof obj[key] === 'object') {
      result[key] = transformObject(obj[key], transformer);
    } else {
      result[key] = obj[key];
    }
  }
  
  return result;
}

generatePseudoLocale();
```

## Performance Optimization

### Translation Loading Optimization
*Template: Define performance optimization strategies*

**Lazy Loading Implementation**:
```typescript
// src/i18n/lazyLoader.ts
import { Resource } from 'i18next';

class LazyTranslationLoader {
  private loadedNamespaces = new Set<string>();
  private loadingPromises = new Map<string, Promise<Resource>>();
  
  async loadNamespace(namespace: string, language: string): Promise<Resource> {
    const key = `${language}:${namespace}`;
    
    if (this.loadedNamespaces.has(key)) {
      return {};
    }
    
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key)!;
    }
    
    const loadPromise = this.fetchTranslations(namespace, language);
    this.loadingPromises.set(key, loadPromise);
    
    try {
      const translations = await loadPromise;
      this.loadedNamespaces.add(key);
      return translations;
    } finally {
      this.loadingPromises.delete(key);
    }
  }
  
  private async fetchTranslations(namespace: string, language: string): Promise<Resource> {
    const response = await fetch(`/locales/${language}/${namespace}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations: ${language}/${namespace}`);
    }
    return response.json();
  }
}

export const lazyLoader = new LazyTranslationLoader();
```

**Bundle Splitting for Translations**:
```typescript
// webpack.config.js
module.exports = {
  // ... other config
  optimization: {
    splitChunks: {
      cacheGroups: {
        translations: {
          test: /[\\/]locales[\\/]/,
          name: 'translations',
          chunks: 'all',
          enforce: true
        }
      }
    }
  }
};
```

---

*Template Note: Internationalization should be implemented from the beginning of the project to avoid costly refactoring later. Regular testing with pseudo-locales and actual translations helps identify layout and functionality issues early. Consider the cultural context and user expectations for each target market, not just language translation.*