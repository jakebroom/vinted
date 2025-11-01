# CSS Components & Design System Guide

**Version:** 1.1.3
**Last Updated:** November 1, 2025

This guide documents all CSS components, their usage, variants, and best practices for the Vinted Inventory System.

---

## Table of Contents

1. [Design Tokens](#design-tokens)
2. [Button Components](#button-components)
3. [Card Components](#card-components)
4. [Form Components](#form-components)
5. [Modal Components](#modal-components)
6. [Glassmorphism Components](#glassmorphism-components)
7. [Performance Optimizations](#performance-optimizations)
8. [Responsive Breakpoints](#responsive-breakpoints)

---

## Design Tokens

### Color Palette

```css
/* Primary Colors */
--color-primary: #667eea;          /* Purple */
--color-primary-dark: #764ba2;     /* Dark Purple */
--color-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Semantic Colors */
--color-success: #27ae60;          /* Green */
--color-danger: #dc3545;           /* Red */
--color-warning: #ff9800;          /* Orange */
--color-info: #17a2b8;             /* Cyan */

/* Neutral Colors */
--color-white: #ffffff;
--color-black: #000000;
--color-gray-100: #f8f9fa;
--color-gray-200: #e9ecef;
--color-gray-300: #dee2e6;
--color-gray-700: #495057;
--color-gray-800: #343a40;
```

### Spacing Scale

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
```

### Typography

```css
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-size-sm: 0.875rem;    /* 14px */
--font-size-base: 1rem;       /* 16px */
--font-size-lg: 1.125rem;     /* 18px */
--font-size-xl: 1.25rem;      /* 20px */
--font-size-2xl: 1.5rem;      /* 24px */
```

### Border Radius

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;           /* Standard cards */
--radius-xl: 18px;
--radius-full: 9999px;
```

### Shadows

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 8px 20px rgba(0, 0, 0, 0.15);
--shadow-xl: 0 12px 30px rgba(0, 0, 0, 0.2);
```

### Transitions

```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
```

### Performance Variables

```css
--blur-light: blur(4px);      /* Light glassmorphism */
--blur-medium: blur(10px);    /* Standard glassmorphism */
--blur-heavy: blur(12px);     /* Heavy glassmorphism */
```

---

## Button Components

### Base Button (.btn)

**Purpose:** Primary action button with purple gradient
**Location:** shared.css
**Performance:** Optimized with `will-change: transform`

**Usage:**
```html
<button class="btn">Primary Action</button>
<a href="/page" class="btn">Link Button</a>
```

**Features:**
- Purple gradient background
- Hover: Lifts 2px with enhanced shadow
- Active: Returns to baseline
- Min height: 44px (WCAG touch target)

### Button Variants

#### .btn-glass
**Purpose:** Transparent button for gradient backgrounds
**Where Used:** Navigation on inventory, insights, management pages

```html
<button class="btn-glass">Transparent Button</button>
```

**Features:**
- Semi-transparent white background (15% opacity)
- White border
- Hover: Brightens to 25% opacity

#### .btn-secondary
**Purpose:** Secondary action button
**Where Used:** Cancel buttons, alternative actions

```html
<button class="btn-secondary">Cancel</button>
```

**Features:**
- Gray solid background
- No border
- Hover: Darkens slightly

#### .btn-info
**Purpose:** Informational actions
**Where Used:** View details, information displays

```html
<button class="btn-info">View Details</button>
```

**Features:**
- Teal gradient (cyan)
- Hover: Enhanced shadow

#### .btn-warning
**Purpose:** Warning or caution actions
**Where Used:** Important but non-critical actions

```html
<button class="btn-warning">Proceed with Caution</button>
```

**Features:**
- Orange gradient
- Hover: Enhanced shadow

#### .btn-small
**Purpose:** Compact buttons for tables/cards
**Where Used:** Action buttons in brand/size management

```html
<button class="btn-small">Edit</button>
```

**Features:**
- Smaller padding (8px 16px)
- Smaller font size (13px)
- Purple gradient

#### .btn-edit
**Purpose:** Edit action buttons
**Where Used:** Management cards

```html
<button class="btn-edit">Edit</button>
```

**Features:**
- Teal gradient
- Same size as .btn-small

#### .btn-toggle
**Purpose:** Toggle active/inactive states
**Where Used:** Brand/size management

```html
<button class="btn-toggle">Toggle</button>
```

**Features:**
- Teal gradient
- Indicates state change action

#### .btn-delete / .btn-danger
**Purpose:** Destructive actions
**Where Used:** Delete operations

```html
<button class="btn-delete">Delete</button>
<button class="btn-danger">Remove</button>
```

**Features:**
- Red gradient
- Hover: Enhanced shadow
- Use sparingly for critical actions

### Button Best Practices

✅ **Do:**
- Use `.btn` for primary actions
- Use `.btn-glass` on gradient backgrounds
- Use `.btn-danger` for destructive actions
- Ensure 44px minimum height for touch targets

❌ **Don't:**
- Mix multiple primary buttons on same screen
- Use `.btn-danger` for non-destructive actions
- Override button colors inline

---

## Card Components

### Base Card (.card)

**Purpose:** Content container with elevation
**Location:** shared.css
**Performance:** Optimized with `will-change: transform`

**Usage:**
```html
<div class="card">
  <div class="card-header">Title</div>
  <div class="card-body">Content</div>
</div>
```

**Features:**
- White background
- 16px border radius (standardized v1.1.3)
- Hover: Lifts 2px with enhanced shadow
- Smooth transitions (200ms)

### Card Variants by Page

#### Insights Page Cards
**Border Radius:** 24px (smoother aesthetic)
**Shadow:** Heavier shadows for depth
**Background:** White with #fff color

```html
<div class="card">
  <div class="card-header">Revenue & Profit by Month</div>
  <div class="card-body">
    <canvas id="chart"></canvas>
  </div>
</div>
```

#### KPI Cards (.kpi)
**Purpose:** Key performance indicators on insights page
**Performance:** Optimized with `will-change: transform`

```html
<div class="kpi">
  <div class="label">Revenue</div>
  <div class="value">£1,234.56</div>
  <div class="sub muted">From sold items</div>
</div>
```

**Features:**
- Glassmorphism background (15% white, heavy blur)
- White text throughout
- Hover: Brightens and lifts
- 20px border radius

#### Management Cards (.quick-action-card, .brand-card, .size-card, .collar-size-card)

**Quick Action Cards:**
```html
<a href="/action" class="quick-action-card">
  <div class="icon">📦</div>
  <div class="label">Add Item</div>
</a>
```

**Brand/Size/Collar Cards:**
```html
<div class="brand-card">
  <div class="brand-info">
    <div class="brand-name">Nike</div>
    <span class="status-badge">Active</span>
  </div>
  <div class="brand-actions">
    <button class="btn-small">Edit</button>
    <button class="btn-toggle">Toggle</button>
    <button class="btn-delete">Delete</button>
  </div>
</div>
```

**Features:**
- 16px border radius (standardized v1.1.3)
- Vertical layout (flex-direction: column)
- Hover: Lifts 4-5px with purple border
- Performance optimized with `will-change`

### Card Best Practices

✅ **Do:**
- Use cards for grouped content
- Include clear header/title
- Maintain consistent spacing
- Use hover states for interactive cards

❌ **Don't:**
- Nest cards more than 2 levels deep
- Exceed 3-4 cards per row on desktop
- Mix different border radii on same page

---

## Form Components

### Input Fields

#### Text Inputs (.input, .search-input)

**Standard Input:**
```html
<input type="text" class="input" placeholder="Enter text">
```

**Search Input (inventory.css):**
```html
<input type="text" class="search-input" placeholder="Search items...">
```

**Features:**
- White text on semi-transparent background
- 2px border (30% white opacity)
- Hover/Focus: Brighter border
- Text shadow for readability (v1.1.3)
- Focus: Box-shadow ring for accessibility

#### Select Dropdowns (.select, .filter-select)

```html
<select class="select">
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>
```

**Features:**
- Matches input styling
- White text with text-shadow
- Focus states (v1.1.3)
- Dropdown options have white background with dark text

### Form Best Practices

✅ **Do:**
- Always include placeholder text
- Use labels for accessibility
- Implement focus states
- Validate on submit

❌ **Don't:**
- Use inputs without labels (screen readers)
- Remove focus outlines
- Use placeholder as label replacement

---

## Modal Components

### Base Modal (.modal)

**Purpose:** Overlay dialogs for forms and details
**Location:** shared.css
**Display Control:** CSS class-based (.show)

**Structure:**
```html
<div class="modal" id="exampleModal">
  <div class="modal-overlay" onclick="closeModal()"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h3 class="modal-title">Modal Title</h3>
    </div>
    <div class="modal-body">
      <!-- Content here -->
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn">Confirm</button>
    </div>
  </div>
</div>
```

**JavaScript Control:**
```javascript
// Open modal
document.getElementById('exampleModal').classList.add('show');

// Close modal
document.getElementById('exampleModal').classList.remove('show');
```

**Features:**
- Flexbox centering (no inline styles needed)
- Click-outside-to-close via overlay
- No X close buttons (v1.1.2 design decision)
- Smooth fade in/out animations
- Scrollable content in modal-body
- Max height: 85vh to prevent overflow

### Modal Sizing

**Standard:** Default width (fit-content with max-width)
**Large:** Add class `.modal-large` for wider modals

### Modal Best Practices

✅ **Do:**
- Use `.show` class to display modals
- Implement overlay click handler
- Limit content height with scrolling
- Use consistent button placement (cancel left, confirm right)

❌ **Don't:**
- Use inline `style.display` manipulation
- Add X close buttons (user preference)
- Exceed 85vh height
- Nest modals

---

## Glassmorphism Components

**Purpose:** Semi-transparent frosted glass effect
**Performance:** Uses consolidated blur variables (v1.1.3)

### Glass Panel (.glass-panel)

```html
<div class="glass-panel">
  Glassmorphism content with blur effect
</div>
```

**Features:**
- Semi-transparent white background
- Backdrop blur filter (--glass-blur variable)
- White text
- Border: 1px solid white (transparent)

### Page-Specific Glassmorphism

#### Inventory Page
- `.controls` - Search and filter controls (--blur-medium)
- `.stats` - Statistics display (--blur-medium)
- `.pagination-controls` - Pagination (--blur-medium)

#### Insights Page
- `.kpi` - KPI cards (--blur-heavy)
- `.controls` - Filter controls (--blur-heavy)

### Performance Note

All glassmorphism elements use CSS custom properties for blur values:
- `--blur-light: blur(4px)` - Subtle effect
- `--blur-medium: blur(10px)` - Standard effect
- `--blur-heavy: blur(12px)` - Prominent effect

This consolidation reduces browser recalculation and improves rendering performance.

---

## Performance Optimizations

### will-change Property

**Applied To:**
- All button variants
- Card components (.card, .kpi, .quick-action-card, .brand-card, .size-card, .collar-size-card)
- Any element with hover transform animations

**Purpose:**
Hints to the browser that an element will animate, enabling GPU acceleration and smoother transitions.

**Example:**
```css
.btn {
  will-change: transform;
  transition: transform 200ms ease;
}

.btn:hover {
  transform: translateY(-2px);
}
```

### Backdrop Filter Optimization

**Consolidated Variables:** v1.1.3
```css
:root {
  --blur-light: blur(4px);
  --blur-medium: blur(10px);
  --blur-heavy: blur(12px);
}

/* Usage */
.controls {
  backdrop-filter: var(--blur-medium);
  -webkit-backdrop-filter: var(--blur-medium);
}
```

**Benefits:**
- Single source of truth for blur values
- Reduced CSS recalculation
- Easier maintenance and updates
- Browser optimization

### Box-Shadow Best Practices

✅ **Do:**
- Use CSS custom properties for shadows
- Apply shadows on hover for depth
- Combine with transform for lift effect

❌ **Don't:**
- Use excessive shadow spreads
- Stack multiple heavy shadows
- Animate shadow properties directly (use opacity instead)

---

## Responsive Breakpoints

### Standard Breakpoints

```css
/* Mobile: < 640px */
@media (max-width: 640px) {
  /* Mobile styles */
}

/* Tablet: 640px - 768px */
@media (min-width: 640px) and (max-width: 768px) {
  /* Tablet styles */
}

/* Desktop: > 768px */
@media (min-width: 768px) {
  /* Desktop styles */
}

/* Large Desktop: > 900px */
@media (min-width: 900px) {
  /* Large desktop styles */
}
```

**Standardized in v1.1.3:** All files now use 640px (previously mixed 600px/640px)

### Mobile-First Approach

Base styles target mobile devices, with progressive enhancement for larger screens:

```css
/* Base (mobile) */
.card-grid {
  grid-template-columns: 1fr;
}

/* Tablet and up */
@media (min-width: 640px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 900px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Page-Specific Responsive Behavior

#### Inventory Page
- **< 768px:** Mobile card view with stacked layout
- **≥ 768px:** Desktop table view
- Table columns hide on mobile (.hide-mobile class)

#### Insights Page
- KPI cards: 4 columns → 2 columns → 1 column (responsive)
- Charts: Full width on mobile, side-by-side on desktop

#### Management Page
- Quick action grid: Auto-fit columns with 200px minimum
- Card sections stack on mobile

---

## Accessibility Guidelines

### WCAG 2.1 AA Compliance

✅ **Implemented:**
- **Touch Targets:** 44px minimum for all interactive elements
- **Focus States:** Visible focus indicators on all inputs and buttons
- **Color Contrast:** Purple gradient provides adequate contrast for white text
- **Keyboard Navigation:** No CSS preventing keyboard focus
- **Reduced Motion:** `prefers-reduced-motion` media query support (shared.css)
- **Text Shadow:** Added to glassmorphism text for better readability (v1.1.3)

### Focus States

All interactive elements have visible focus states:

```css
.input:focus,
.select:focus {
  outline: none;
  border-color: rgba(255,255,255,0.6);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
}

button:focus-visible {
  outline: 3px solid rgba(102, 126, 234, 0.5);
  outline-offset: 2px;
}
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Component Usage Matrix

| Component | Inventory | Management | Insights | Performance |
|-----------|-----------|------------|----------|-------------|
| `.btn` | ✓ | ✓ | ✓ | will-change |
| `.btn-glass` | ✓ | ✓ | ✓ | will-change |
| `.btn-secondary` | ✓ | ✓ | ✓ | will-change |
| `.btn-small` | - | ✓ | - | will-change |
| `.btn-delete` | ✓ | ✓ | - | will-change |
| `.card` | - | ✓ | ✓ | will-change |
| `.kpi` | - | - | ✓ | will-change |
| `.modal` | ✓ | ✓ | - | - |
| `.glass-panel` | - | - | - | blur vars |
| `.controls` | ✓ | - | ✓ | blur vars |

---

## Version History

### v1.1.3 (Current)
- Added performance optimizations (`will-change`, blur variables)
- Standardized mobile breakpoint to 640px
- Standardized card border radius to 16px
- Added text-shadow to glassmorphism elements
- Added focus states to insights page inputs

### v1.1.2
- Modal system refactored to CSS class-based
- Removed X close buttons from modals
- Enhanced button styling with gradients
- Improved card layouts (vertical brand/size cards)
- White text on insights page
- Widened inventory table to 95%

### v1.1.0
- Created shared.css for common styles
- Consolidated CSS variables
- Established design token system

---

## Quick Reference

**Need a primary button?** → `.btn`
**Need a button on gradient background?** → `.btn-glass`
**Need a delete button?** → `.btn-delete` or `.btn-danger`
**Need a card?** → `.card` (16px radius), `.kpi` (insights), or page-specific variants
**Need a modal?** → Use `.modal` with `.show` class
**Need glassmorphism?** → Use `--blur-*` variables with semi-transparent backgrounds
**Need form input?** → `.input` or `.search-input`

---

**Last Updated:** November 1, 2025
**Maintained by:** Claude Code
**Project:** Vinted Inventory System
