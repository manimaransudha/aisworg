# Design Tokens

**Phase**: 02 - Experience Design (aka: UX/UI Design, Experience Architecture, Experience Blueprinting, Design Sprint)  
**Deliverable Type**: Design Token Specifications  
**Template Purpose**: Define atomic design values that ensure consistency across all platform interfaces  
**Last Updated**: November 2025

## Executive Summary

*This document defines the design tokens for NoteShare Pro - the atomic values that form the foundation of our design system. These tokens ensure visual consistency, enable efficient design-to-development handoff, and support scalable design maintenance across all platform touchpoints.*

Design tokens serve as the single source of truth for all visual design decisions, enabling consistent experiences while allowing for easy theme updates and brand evolution.

## Template Guidance

*Design tokens are the atomic values of your design system - colors, typography, spacing, and other visual properties stored as data. This document should define all token categories, naming conventions, and usage guidelines. Use tokens to maintain consistency across platforms and enable efficient design system maintenance.*

## Token Architecture

### Token Hierarchy
```
Global Tokens (Brand Foundation)
├── Alias Tokens (Semantic Meaning)
└── Component Tokens (Specific Usage)
```

**Global Tokens**: Raw values (colors, sizes, fonts)
**Alias Tokens**: Semantic purpose (primary, secondary, success)
**Component Tokens**: Specific component usage (button-primary-background)

### Naming Convention
**Format**: `category-property-variant-state`
**Examples**:
- `color-primary-500` (Global)
- `color-background-primary` (Alias)
- `button-background-primary-hover` (Component)

*Template Note: Establish a clear token hierarchy and naming system that scales with your design system growth. Include examples of how tokens relate to each other.*

## Color Tokens

### Global Color Palette

**Primary Blue Scale**
```json
{
  "color-primary-50": "#EFF6FF",
  "color-primary-100": "#DBEAFE",
  "color-primary-200": "#BFDBFE",
  "color-primary-300": "#93C5FD",
  "color-primary-400": "#60A5FA",
  "color-primary-500": "#3B82F6",
  "color-primary-600": "#2563EB",
  "color-primary-700": "#1D4ED8",
  "color-primary-800": "#1E40AF",
  "color-primary-900": "#1E3A8A"
}
```

**Neutral Gray Scale**
```json
{
  "color-neutral-50": "#F9FAFB",
  "color-neutral-100": "#F3F4F6",
  "color-neutral-200": "#E5E7EB",
  "color-neutral-300": "#D1D5DB",
  "color-neutral-400": "#9CA3AF",
  "color-neutral-500": "#6B7280",
  "color-neutral-600": "#4B5563",
  "color-neutral-700": "#374151",
  "color-neutral-800": "#1F2937",
  "color-neutral-900": "#111827"
}
```

**Semantic Color Scales**
```json
{
  "color-success-50": "#ECFDF5",
  "color-success-500": "#10B981",
  "color-success-600": "#059669",
  "color-success-700": "#047857",
  
  "color-warning-50": "#FFFBEB",
  "color-warning-500": "#F59E0B",
  "color-warning-600": "#D97706",
  "color-warning-700": "#B45309",
  
  "color-error-50": "#FEF2F2",
  "color-error-500": "#EF4444",
  "color-error-600": "#DC2626",
  "color-error-700": "#B91C1C"
}
```

### Alias Color Tokens

**Background Colors**
```json
{
  "color-background-primary": "{color-neutral-50}",
  "color-background-secondary": "{color-neutral-100}",
  "color-background-tertiary": "{color-neutral-200}",
  "color-background-inverse": "{color-neutral-900}",
  "color-background-brand": "{color-primary-600}",
  "color-background-success": "{color-success-50}",
  "color-background-warning": "{color-warning-50}",
  "color-background-error": "{color-error-50}"
}
```

**Text Colors**
```json
{
  "color-text-primary": "{color-neutral-900}",
  "color-text-secondary": "{color-neutral-700}",
  "color-text-tertiary": "{color-neutral-500}",
  "color-text-placeholder": "{color-neutral-400}",
  "color-text-inverse": "{color-neutral-50}",
  "color-text-brand": "{color-primary-600}",
  "color-text-success": "{color-success-700}",
  "color-text-warning": "{color-warning-700}",
  "color-text-error": "{color-error-700}"
}
```

**Border Colors**
```json
{
  "color-border-primary": "{color-neutral-300}",
  "color-border-secondary": "{color-neutral-200}",
  "color-border-focus": "{color-primary-500}",
  "color-border-success": "{color-success-500}",
  "color-border-warning": "{color-warning-500}",
  "color-border-error": "{color-error-500}"
}
```

*Template Note: Define your color tokens at multiple levels of abstraction. Start with global color scales, then create semantic aliases that can be used consistently across components.*

## Typography Tokens

### Font Family Tokens
```json
{
  "font-family-primary": "Inter, system-ui, -apple-system, sans-serif",
  "font-family-secondary": "system-ui, -apple-system, sans-serif",
  "font-family-mono": "SF Mono, Monaco, Consolas, monospace"
}
```

### Font Size Tokens
```json
{
  "font-size-xs": "12px",
  "font-size-sm": "14px",
  "font-size-base": "16px",
  "font-size-lg": "18px",
  "font-size-xl": "20px",
  "font-size-2xl": "24px",
  "font-size-3xl": "30px",
  "font-size-4xl": "36px",
  "font-size-5xl": "48px"
}
```

### Font Weight Tokens
```json
{
  "font-weight-light": "300",
  "font-weight-regular": "400",
  "font-weight-medium": "500",
  "font-weight-semibold": "600",
  "font-weight-bold": "700"
}
```

### Line Height Tokens
```json
{
  "line-height-tight": "1.25",
  "line-height-normal": "1.5",
  "line-height-relaxed": "1.75"
}
```

### Typography Alias Tokens
```json
{
  "typography-display-large": {
    "font-family": "{font-family-primary}",
    "font-size": "{font-size-5xl}",
    "font-weight": "{font-weight-bold}",
    "line-height": "{line-height-tight}"
  },
  "typography-heading-1": {
    "font-family": "{font-family-primary}",
    "font-size": "{font-size-3xl}",
    "font-weight": "{font-weight-semibold}",
    "line-height": "{line-height-tight}"
  },
  "typography-body-large": {
    "font-family": "{font-family-primary}",
    "font-size": "{font-size-lg}",
    "font-weight": "{font-weight-regular}",
    "line-height": "{line-height-normal}"
  },
  "typography-body-regular": {
    "font-family": "{font-family-primary}",
    "font-size": "{font-size-base}",
    "font-weight": "{font-weight-regular}",
    "line-height": "{line-height-normal}"
  }
}
```

*Template Note: Create typography tokens that cover your complete type scale. Include composite tokens that combine multiple properties for common text styles.*

## Spacing Tokens

### Base Spacing Scale
```json
{
  "spacing-0": "0px",
  "spacing-1": "4px",
  "spacing-2": "8px",
  "spacing-3": "12px",
  "spacing-4": "16px",
  "spacing-5": "20px",
  "spacing-6": "24px",
  "spacing-8": "32px",
  "spacing-10": "40px",
  "spacing-12": "48px",
  "spacing-16": "64px",
  "spacing-20": "80px",
  "spacing-24": "96px"
}
```

### Semantic Spacing Tokens
```json
{
  "spacing-xs": "{spacing-1}",
  "spacing-sm": "{spacing-2}",
  "spacing-md": "{spacing-4}",
  "spacing-lg": "{spacing-6}",
  "spacing-xl": "{spacing-8}",
  "spacing-2xl": "{spacing-12}",
  "spacing-3xl": "{spacing-16}"
}
```

### Layout Spacing Tokens
```json
{
  "spacing-component-padding-sm": "{spacing-3}",
  "spacing-component-padding-md": "{spacing-4}",
  "spacing-component-padding-lg": "{spacing-6}",
  "spacing-section-gap": "{spacing-8}",
  "spacing-page-margin": "{spacing-6}",
  "spacing-container-max-width": "1200px"
}
```

*Template Note: Define spacing tokens that create consistent rhythm and hierarchy in your layouts. Include both granular spacing options and semantic spacing for common use cases.*

## Size & Dimension Tokens

### Icon Sizes
```json
{
  "size-icon-xs": "12px",
  "size-icon-sm": "16px",
  "size-icon-md": "20px",
  "size-icon-lg": "24px",
  "size-icon-xl": "32px"
}
```

### Component Sizes
```json
{
  "size-button-height-sm": "32px",
  "size-button-height-md": "40px",
  "size-button-height-lg": "48px",
  "size-input-height": "40px",
  "size-avatar-sm": "32px",
  "size-avatar-md": "40px",
  "size-avatar-lg": "48px"
}
```

### Layout Dimensions
```json
{
  "size-sidebar-width": "280px",
  "size-sidebar-collapsed": "64px",
  "size-topbar-height": "64px",
  "size-mobile-bottombar-height": "56px",
  "size-container-max-width": "1200px"
}
```

*Template Note: Define size tokens for consistent component dimensions and layout measurements across your product.*

## Border & Radius Tokens

### Border Width Tokens
```json
{
  "border-width-none": "0px",
  "border-width-thin": "1px",
  "border-width-medium": "2px",
  "border-width-thick": "4px"
}
```

### Border Radius Tokens
```json
{
  "border-radius-none": "0px",
  "border-radius-sm": "4px",
  "border-radius-md": "6px",
  "border-radius-lg": "8px",
  "border-radius-xl": "12px",
  "border-radius-full": "9999px"
}
```

### Component Border Tokens
```json
{
  "border-button": "{border-width-thin} solid {color-border-primary}",
  "border-input": "{border-width-thin} solid {color-border-primary}",
  "border-card": "{border-width-thin} solid {color-border-secondary}",
  "border-focus": "{border-width-medium} solid {color-border-focus}"
}
```

*Template Note: Define border and radius tokens that create consistent visual treatment across interactive elements and content containers.*

## Shadow & Elevation Tokens

### Shadow Tokens
```json
{
  "shadow-none": "none",
  "shadow-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  "shadow-md": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  "shadow-lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  "shadow-xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
}
```

### Elevation Semantic Tokens
```json
{
  "elevation-card": "{shadow-sm}",
  "elevation-dropdown": "{shadow-md}",
  "elevation-modal": "{shadow-lg}",
  "elevation-tooltip": "{shadow-xl}"
}
```

*Template Note: Create shadow tokens that establish visual hierarchy and depth in your interface. Use semantic names for common elevation patterns.*

## Animation & Transition Tokens

### Duration Tokens
```json
{
  "duration-instant": "0ms",
  "duration-fast": "150ms",
  "duration-normal": "300ms",
  "duration-slow": "500ms"
}
```

### Easing Tokens
```json
{
  "easing-linear": "linear",
  "easing-ease": "ease",
  "easing-ease-in": "ease-in",
  "easing-ease-out": "ease-out",
  "easing-ease-in-out": "ease-in-out"
}
```

### Transition Tokens
```json
{
  "transition-color": "color {duration-fast} {easing-ease-out}",
  "transition-background": "background-color {duration-fast} {easing-ease-out}",
  "transition-border": "border-color {duration-fast} {easing-ease-out}",
  "transition-transform": "transform {duration-normal} {easing-ease-out}",
  "transition-opacity": "opacity {duration-normal} {easing-ease-out}"
}
```

*Template Note: Define animation tokens that create consistent motion and timing across your interface interactions.*

## Component-Specific Tokens

### Button Tokens
```json
{
  "button-primary-background": "{color-primary-600}",
  "button-primary-background-hover": "{color-primary-700}",
  "button-primary-text": "{color-neutral-50}",
  "button-primary-border-radius": "{border-radius-md}",
  "button-primary-padding-x": "{spacing-4}",
  "button-primary-padding-y": "{spacing-2}",
  
  "button-secondary-background": "{color-neutral-50}",
  "button-secondary-background-hover": "{color-neutral-100}",
  "button-secondary-text": "{color-primary-600}",
  "button-secondary-border": "{border-width-thin} solid {color-primary-600}"
}
```

### Input Tokens
```json
{
  "input-background": "{color-neutral-50}",
  "input-background-focus": "{color-neutral-50}",
  "input-border": "{border-width-thin} solid {color-border-primary}",
  "input-border-focus": "{border-width-medium} solid {color-border-focus}",
  "input-border-radius": "{border-radius-md}",
  "input-padding-x": "{spacing-3}",
  "input-padding-y": "{spacing-2}",
  "input-text": "{color-text-primary}",
  "input-placeholder": "{color-text-placeholder}"
}
```

### Card Tokens
```json
{
  "card-background": "{color-neutral-50}",
  "card-border": "{border-width-thin} solid {color-border-secondary}",
  "card-border-radius": "{border-radius-lg}",
  "card-padding": "{spacing-6}",
  "card-shadow": "{shadow-sm}",
  "card-shadow-hover": "{shadow-md}"
}
```

*Template Note: Create component-specific tokens that encapsulate all the visual properties needed for consistent component implementation.*

## Platform-Specific Tokens

### Web Platform Tokens
```json
{
  "web-font-size-base": "16px",
  "web-line-height-base": "1.5",
  "web-focus-outline": "2px solid {color-primary-500}",
  "web-focus-outline-offset": "2px"
}
```

### Mobile Platform Tokens
```json
{
  "mobile-font-size-base": "16px",
  "mobile-touch-target-min": "44px",
  "mobile-spacing-touch-buffer": "{spacing-2}",
  "mobile-border-radius-base": "{border-radius-lg}"
}
```

*Template Note: Define platform-specific tokens that account for different interaction patterns and technical constraints across web, mobile, and other platforms.*

## Token Implementation

### CSS Custom Properties
```css
:root {
  /* Color Tokens */
  --color-primary-600: #2563EB;
  --color-text-primary: #111827;
  --color-background-primary: #F9FAFB;
  
  /* Typography Tokens */
  --font-family-primary: Inter, system-ui, sans-serif;
  --font-size-base: 16px;
  --font-weight-regular: 400;
  
  /* Spacing Tokens */
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* Component Tokens */
  --button-primary-background: var(--color-primary-600);
  --button-padding-x: var(--spacing-md);
}
```

### JavaScript/JSON Format
```javascript
export const tokens = {
  color: {
    primary: {
      600: '#2563EB'
    },
    text: {
      primary: '#111827'
    }
  },
  spacing: {
    md: '16px',
    lg: '24px'
  },
  typography: {
    fontFamily: {
      primary: 'Inter, system-ui, sans-serif'
    }
  }
};
```

### Design Tool Integration
- **Figma**: Use Figma tokens plugin for design-development sync
- **Sketch**: Implement through shared libraries and symbols
- **Adobe XD**: Use Creative Cloud Libraries for token distribution

*Template Note: Provide implementation examples for how tokens will be used in code and design tools. Include specific formats and integration methods.*

## Token Governance

### Update Process
1. **Proposal**: Submit token change request with rationale
2. **Review**: Design system team evaluates impact and alternatives
3. **Testing**: Validate changes across affected components
4. **Documentation**: Update token specifications and usage guidelines
5. **Implementation**: Deploy changes across design and development tools
6. **Communication**: Notify teams of changes and migration requirements

### Version Control
- **Semantic Versioning**: Major.Minor.Patch format for token releases
- **Breaking Changes**: Major version updates for token removals or significant changes
- **Deprecation**: 6-month notice period for token deprecation
- **Migration Guides**: Detailed instructions for updating to new token versions

### Quality Assurance
- **Automated Testing**: Token validation in CI/CD pipeline
- **Visual Regression**: Automated screenshot comparison for token changes
- **Accessibility Validation**: Contrast ratio and accessibility compliance checking
- **Cross-Platform Testing**: Validation across web, mobile, and other platforms

*Template Note: Establish governance processes that ensure token quality and consistency while enabling necessary evolution and updates.*