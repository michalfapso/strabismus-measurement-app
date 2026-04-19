# Hamburger Menu Implementation Spec

## Overview
Add a responsive hamburger menu to the top toolbar that displays the 4 main navigation buttons on mobile/tablet screens. The hamburger menu should appear only on screens narrower than 768px.

## Navigation Items
The hamburger menu should contain:
1. **Measurement** - Records a new measurement session
2. **History** - Views historical sessions and trends
3. **Settings** - Opens settings/configuration page
4. **Recalibrate** - Triggers PPI recalibration

## UI Components

### Desktop (≥768px)
- Hamburger menu is hidden
- Navigation items are displayed inline in the top toolbar as buttons
- Current layout is maintained

### Mobile/Tablet (<768px)
- Hamburger icon (☰) appears in the top-left of the toolbar
- Clicking the hamburger opens a menu panel with the 4 navigation items
- Menu can be closed by:
  - Clicking a navigation item
  - Clicking outside the menu (on the darkened background)
  - Tapping a close/back button if provided
- Menu should slide in from the left (consistent with the History drawer)

## Design Details

### Hamburger Icon
- SVG icon (≡) or three horizontal lines
- Size: ~24x24px
- Color: matches the text color of the toolbar
- Positioned at top-left, inside the toolbar

### Menu Panel
- Full-height panel that slides in from the left
- Width: ~200-250px (or full screen depending on aesthetic preference)
- Darkened background overlay on the main content (semi-transparent)
- Z-index: high enough to appear above all content

### Menu Items
- Display as a list with clear visual separation
- Each item is a clickable button/link
- Highlight the currently active page
- Show icons alongside text (optional but recommended)
- Font size: 16px or larger for mobile touch targets
- Padding: generous (12px+ vertical) for easy tapping

### Animation
- Menu slides in from the left (100-200ms transition)
- Background overlay fades in
- Menu slides out when closed

## Implementation Notes

### State Management
- Track whether the menu is open/closed
- Consider using a React context or component state for menu visibility
- Ensure menu closes when navigating to a new page

### Keyboard/Accessibility
- Close menu when Escape key is pressed
- Focus management: focus should move to the menu when it opens
- Menu items should be keyboard navigable
- Implement proper ARIA labels

### Mobile Gestures
- Optionally support swiping from left edge to open menu
- Optionally support swiping right within menu to close

### Current Navigation Implementation
Check how navigation currently works in the app (likely using React Router or similar). The hamburger menu should integrate seamlessly with the existing routing system.

## Files to Create/Modify
- Create: `src/components/HamburgerMenu.tsx` - Main menu component
- Modify: `src/components/TopToolbar.tsx` or main layout component - Add hamburger icon and responsive logic
- Modify: CSS/theme file if needed for menu styling

## Testing Checklist
- [ ] Menu appears only on screens <768px
- [ ] Menu opens/closes correctly
- [ ] Navigation items work correctly
- [ ] Menu closes when an item is clicked
- [ ] Menu closes when background is clicked
- [ ] Keyboard navigation works (Tab, Escape)
- [ ] Active page is highlighted
- [ ] No layout shift when menu opens (use position: fixed or absolute)
- [ ] Mobile gesture handling works if implemented
- [ ] Responsive behavior at different viewport sizes
