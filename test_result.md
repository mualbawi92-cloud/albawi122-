# Template Designer - Save and Apply Feature Test

## Test Context
Testing the "Save and Apply" (حفظ وتطبيق) feature in the Visual Template Designer.

## Feature Requirements
1. When user clicks "Save and Apply", the template should be saved
2. The template should be set as active for its type (e.g., send_transfer)
3. The active template should be used when printing receipts

## Test Scenarios
1. **Login as admin** - Credentials: admin/admin123
2. **Navigate to Visual Designer** - /visual-designer
3. **Make a change to the template** - Add a distinctive element
4. **Click "حفظ وتطبيق" (Save and Apply)**
5. **Verify success message appears**
6. **Navigate to transfer creation** - /transfers/new
7. **Create a test transfer and print receipt**
8. **Verify the printed receipt uses the updated template**

## Test Credentials
- Username: admin
- Password: admin123

## API Endpoints
- POST /api/visual-templates - Create template
- POST /api/visual-templates/{id}/set-active - Set template as active
- GET /api/visual-templates/active/{type} - Get active template for type
