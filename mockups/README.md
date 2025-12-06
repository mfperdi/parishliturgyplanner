# Web App Mockups - Viewing Instructions

## 📱 How to View the Mockups

### Desktop View
1. Open any `.html` file in your browser:
   - **Dashboard:** `dashboard-mockup.html`
   - **Volunteers CRUD:** `volunteers-mockup.html`

2. View at full screen width to see desktop layout

### Mobile View
**Option 1: Resize Browser**
1. Open the mockup file
2. Open browser Developer Tools (F12 or Right-click > Inspect)
3. Click the device toolbar icon (📱) or press `Ctrl+Shift+M` (Windows) / `Cmd+Shift+M` (Mac)
4. Select a mobile device (iPhone, Android) or resize to width < 768px

**Option 2: Use Actual Mobile Device**
1. Copy the HTML files to a web server or use a local server
2. Open on your phone/tablet browser
3. See the actual mobile experience

---

## 🎨 Mockup Features

### Dashboard Mockup (`dashboard-mockup.html`)

#### Desktop Features
- **Navigation Bar:** Full menu with dropdowns
- **Statistics Cards:** 4-column layout showing key metrics
  - Active Volunteers
  - Upcoming Masses
  - Open Assignments
  - Timeoff Requests
- **Quick Actions:** 4 large buttons for common tasks
  - Generate Schedule
  - Add Volunteer
  - Auto-Assign
  - Print Schedule
- **Recent Activity:** Chronological feed of recent actions
- **Upcoming Masses:** Sidebar showing this week's masses with status

#### Mobile Features (< 768px)
- **Collapsible Navigation:** Hamburger menu
- **Stacked Statistics:** Cards stack vertically
- **2-Column Quick Actions:** Buttons arrange in 2x2 grid
- **Single Column Layout:** Recent Activity and Upcoming Masses stack
- **Touch-Friendly:** All buttons minimum 44px tap targets

---

### Volunteers Mockup (`volunteers-mockup.html`)

#### Desktop Features
- **Data Table:** Full volunteer information in table format
  - ID, Name, Email, Phone, Status, Ministry Role, Preferred Mass
  - Edit and Delete action buttons
  - Sortable columns (mockup only)
- **Filter Bar:** Search + dropdown filters
  - Search by name/email
  - Filter by status
  - Filter by ministry role
- **Pagination:** Navigate through volunteer list
- **Add/Edit Modal:** Full-screen modal form with sections:
  - Personal Information (Name, Email, Phone)
  - Ministry Information (Status, Family Team, Roles, Preferences)

#### Mobile Features (< 768px)
- **Card View Instead of Table:** Each volunteer displayed as a card
  - Name, ID, Status badge
  - Contact info with icons
  - Ministry roles and preferences
  - Edit/Delete buttons
- **Simplified Filters:** Stacks vertically
- **Full-Screen Modal:** Form fills entire screen on mobile
- **Touch-Optimized:** Large buttons and input fields

---

## 🔍 What to Look For

### Responsive Breakpoints

**Desktop (≥ 768px)**
- Multi-column layouts
- Full tables
- Horizontal navigation
- Sidebar layouts
- More information visible

**Mobile (< 768px)**
- Single column layouts
- Card-based views (no tables)
- Hamburger navigation
- Stacked content
- Essential information only

### User Experience Features

1. **Visual Hierarchy**
   - Parish purple color scheme (#5c2d91)
   - Clear headings and sections
   - Color-coded status badges
   - Icons for quick recognition

2. **Interactive Elements**
   - Hover effects on cards and buttons
   - Modal dialogs for forms
   - Dropdown menus
   - Toast notifications (mentioned in mockup)

3. **Touch-Friendly Design**
   - Minimum 44px button size
   - Adequate spacing between elements
   - Large tap targets
   - No hover-dependent features

4. **Data Presentation**
   - **Desktop:** Dense tables with lots of information
   - **Mobile:** Simplified cards with essential data
   - Status badges with color coding:
     - Green = Active
     - Blue = Ministry Sponsor
     - Yellow = Substitute Only
     - Gray = Inactive

---

## 📊 Mockup Data

### Sample Volunteers
The mockup includes 6 sample volunteers with different statuses:
1. Sarah Johnson - Active (Lector, Eucharistic Minister)
2. Michael Chen - Active (Lector)
3. Emily Rodriguez - Ministry Sponsor
4. David Thompson - Substitute Only
5. Maria Garcia - Inactive
6. James Wilson - Active (Eucharistic Minister, Usher)

### Sample Statistics (Dashboard)
- 142 Active Volunteers
- 24 Upcoming Masses this week
- 7 Open Assignments
- 3 Pending Timeoff Requests

---

## 🧪 Testing Scenarios

### Test 1: Navigation
1. Click navigation menu items
2. Test dropdown menus
3. On mobile, test hamburger menu collapse/expand
4. Click logo to return to dashboard

### Test 2: Responsive Behavior
1. Start at desktop width (1200px+)
2. Slowly resize browser narrower
3. Watch layout changes at 768px breakpoint
4. Continue to mobile width (375px)
5. Note how content reorganizes

### Test 3: Forms
1. Click "Add Volunteer" button
2. Modal should open with empty form
3. Fill out form fields
4. Click "Edit" button on a volunteer
5. Form should populate with volunteer data
6. Close modal and note form resets

### Test 4: Filters
1. Type in search box
2. Select status dropdown
3. Select ministry role dropdown
4. Click "Apply Filters" button
5. Note visual feedback (mockup doesn't filter, but shows UI)

---

## 🎯 Design Decisions

### Why Bootstrap 5?
- **Mobile-first:** Built for responsive design
- **Proven:** Used by millions of websites
- **Complete:** UI components, grid system, utilities
- **Accessible:** ARIA support, keyboard navigation
- **Lightweight:** ~50KB gzipped
- **No jQuery:** Pure JavaScript

### Why Card View on Mobile?
- Tables are hard to read on small screens
- Cards show essential info clearly
- Easier to scan vertically
- Better touch targets
- Natural mobile pattern

### Why Modals for Forms?
- Focuses user attention
- Saves screen space
- Easy to dismiss
- Works on all screen sizes
- Consistent experience

### Color Scheme
- **Primary Purple (#5c2d91):** Parish branding
- **Status Colors:**
  - Success Green: Active, positive states
  - Info Blue: Special roles (Ministry Sponsor)
  - Warning Yellow: Caution states (Substitute Only)
  - Danger Red: Alerts, errors
  - Secondary Gray: Inactive, disabled

---

## 📝 Notes for Implementation

### What's NOT in the Mockups
These mockups are static HTML. The real app will have:
- ✅ Live data from Google Sheets
- ✅ Working search and filters
- ✅ Actual CRUD operations (Create, Read, Update, Delete)
- ✅ Form validation
- ✅ Loading spinners
- ✅ Toast notifications (success/error messages)
- ✅ Sorting and pagination
- ✅ Real-time updates
- ✅ User authentication
- ✅ Error handling

### What IS Demonstrated
- ✅ Responsive layout behavior
- ✅ Visual design and branding
- ✅ Navigation structure
- ✅ Form layouts
- ✅ Data presentation (table vs cards)
- ✅ Status badges and icons
- ✅ Button styles and placement
- ✅ Touch-friendly sizing
- ✅ Modal dialogs
- ✅ Filter interface

---

## 🚀 Next Steps

After reviewing these mockups:

1. **Provide Feedback**
   - Do you like the color scheme?
   - Is the layout intuitive?
   - Any features to add/change?
   - Mobile experience satisfactory?

2. **Approve Design**
   - If mockups look good, we proceed to implementation
   - If changes needed, we'll iterate on mockups first

3. **Start Development**
   - Build actual Apps Script web app
   - Connect to Google Sheets data
   - Implement all CRUD operations
   - Add remaining modules (Mass Templates, Timeoffs, etc.)

---

## 🎨 Customization Options

Easy to customize:
- **Colors:** Change CSS variables for parish colors
- **Logo:** Add parish logo in navbar
- **Fonts:** Change to parish preferred fonts
- **Language:** All text is customizable
- **Layout:** Adjust column widths, card sizes, etc.
- **Features:** Add/remove fields, filters, etc.

---

## ❓ Questions?

Common questions:

**Q: Will this work offline?**
A: Not yet, but we can add Progressive Web App (PWA) features for offline mode.

**Q: Can volunteers access this?**
A: Yes! We can build a volunteer-only view with limited permissions.

**Q: Will it work on tablets?**
A: Yes! Bootstrap handles tablet sizes (768px - 1024px) automatically.

**Q: Can we customize colors?**
A: Absolutely! Just change the CSS variables.

**Q: Will this replace the Google Sheets sidebar?**
A: This is an *addition*, not a replacement. You'll have both options.

---

**Ready to move forward?** Review the mockups and let me know what you think!
