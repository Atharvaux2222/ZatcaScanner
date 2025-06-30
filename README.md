# ZATCA QR Code Scanner

A professional web application for scanning and processing Saudi Arabia's ZATCA QR codes found on invoices. This application provides businesses with a comprehensive solution to scan, validate, and export invoice data from QR codes in compliance with Saudi Arabian tax regulations.

## 🚀 Features

- **Real-time QR Code Scanning**: Camera-based scanning with automatic QR code detection
- **File Upload Support**: Upload images containing QR codes for processing
- **ZATCA Compliance**: Specialized parser for Saudi Arabia's ZATCA QR code format
- **Data Validation**: Automatic validation of invoice data and QR code structure
- **Excel Export**: Professional Excel reports with company branding and financial summaries
- **Session Management**: Organize scans by sessions with persistent data storage
- **Manual Entry**: Option to manually enter QR code data when scanning is not possible
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Flashlight Control**: Built-in flashlight toggle for scanning in low-light conditions

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Radix UI for accessible components
- TanStack Query for state management
- QR Scanner library for camera integration

**Backend:**
- Node.js with Express.js
- TypeScript for type safety
- Drizzle ORM for database operations
- PostgreSQL for data persistence
- In-memory storage option for development

**Deployment:**
- Replit for development environment
- Railway and Vercel configurations included
- Docker support for containerized deployment

### Application Flow

```
1. User opens application
2. System creates a unique scanning session
3. User scans QR codes via camera or file upload
4. System parses ZATCA QR format using TLV (Tag-Length-Value) structure
5. Extracted data is validated and stored
6. Results displayed in real-time table
7. User can export data to Excel with professional formatting
8. Session data persists until manually cleared
```

## 📋 How It Works

### QR Code Processing

1. **Scan Detection**: The application continuously monitors the camera feed for QR codes
2. **Data Extraction**: When a QR code is detected, the raw data is extracted
3. **ZATCA Parsing**: The data is parsed using Saudi Arabia's ZATCA format specification:
   - Seller Name (Tag 1)
   - VAT Registration Number (Tag 2)
   - Timestamp (Tag 3)
   - Invoice Total (Tag 4)
   - VAT Amount (Tag 5)
   - Digital Signature (Tag 6)
   - Public Key (Tag 7)
   - Invoice Number (Tag 8)
   - Additional Data (Tag 9)

4. **Validation**: The parsed data is validated for completeness and format compliance
5. **Storage**: Valid and invalid scans are stored with status indicators

### Data Management

- **Sessions**: Each user gets a unique session ID for organizing their scans
- **Duplicate Detection**: Prevents duplicate QR codes within the same session
- **Data Persistence**: All scan data is stored in PostgreSQL or in-memory storage
- **Export Options**: Users can export all data, selected records, or only valid records

### Excel Export Features

- **Professional Branding**: ZatScan logo and company information
- **Financial Summary**: Automatic calculation of totals, VAT amounts, and subtotals
- **Customizable Options**: Include/exclude headers, filter by validity status
- **Formatted Layout**: Professional Excel formatting with proper column widths
- **Support Information**: Contact details and website links included

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 20 or higher
- PostgreSQL database (optional, can use in-memory storage)
- Modern web browser with camera access

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zatca-qr-scanner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file with:
   ```env
   NODE_ENV=development
   DATABASE_URL=your_postgresql_connection_string (optional)
   ```

4. **Database Setup** (if using PostgreSQL)
   ```bash
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5000`

### Production Build

```bash
npm run build
npm start
```

## 🚀 Deployment

### Railway Deployment

1. Connect your repository to Railway
2. Add environment variables in Railway dashboard
3. Deploy automatically builds and starts the application

### Vercel Deployment

1. Import project to Vercel
2. Configure environment variables
3. Deploy with automatic serverless function creation

### Docker Deployment

```bash
docker build -t zatca-qr-scanner .
docker run -p 5000:5000 zatca-qr-scanner
```

## 📱 Usage Guide

### Scanning QR Codes

1. **Camera Scanning**:
   - Allow camera permissions when prompted
   - Point camera at QR code on invoice
   - QR code will be automatically detected and processed
   - Use flashlight toggle for better visibility in dark conditions

2. **File Upload**:
   - Click "Upload Image" button
   - Select image file containing QR code
   - System will extract and process the QR code

3. **Manual Entry**:
   - Click "Manual Entry" button
   - Enter QR code data manually
   - Submit for processing

### Managing Scan Results

- **View Details**: Click on any scan result to see detailed invoice information
- **Select Records**: Use checkboxes to select specific records for export
- **Clear Session**: Remove all scan data with confirmation dialog
- **Export Data**: Generate Excel reports with customizable options

### Excel Export Options

- **Export Range**: Choose between all records, selected records, or valid records only
- **Include Headers**: Option to include/exclude column headers
- **Custom Filename**: Set custom filename for exported file
- **Professional Format**: Automatic formatting with company branding

## 🔧 Configuration

### Environment Variables

- `NODE_ENV`: Set to 'production' for production builds
- `DATABASE_URL`: PostgreSQL connection string (optional)
- `PORT`: Server port (defaults to 5000)

### Customization

- **Branding**: Update logo and company information in `client/src/lib/excel-export.ts`
- **Styling**: Modify Tailwind CSS classes in component files
- **QR Format**: Extend ZATCA parser in `client/src/lib/zatca-parser.ts`

## 🔍 API Endpoints

### Sessions
- `POST /api/sessions` - Create new scanning session
- `GET /api/sessions/:id/stats` - Get session statistics

### QR Codes
- `POST /api/qr-codes` - Add new scanned QR code
- `GET /api/qr-codes/:sessionId` - Get all QR codes for session
- `DELETE /api/qr-codes/:id` - Delete specific QR code
- `DELETE /api/sessions/:sessionId/qr-codes` - Clear all QR codes in session

## 🧪 Testing

The application includes comprehensive error handling and validation:

- **QR Code Validation**: Ensures proper ZATCA format compliance
- **Duplicate Prevention**: Prevents duplicate scans within sessions
- **Error Handling**: Graceful handling of invalid QR codes and network errors
- **Session Management**: Automatic session creation and cleanup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For technical support and inquiries:
- Website: [www.zatscan.com](https://www.zatscan.com)
- Contact: [www.zatscan.com/contact](https://www.zatscan.com/contact)

## 📄 License

This project is licensed under the MIT License.

## 🔮 Future Enhancements

- Multi-language support
- Batch processing capabilities
- Advanced analytics and reporting
- Integration with accounting systems
- Mobile app version
- Cloud storage options

---

**ZatScan** - Professional ZATCA QR Code Scanner for Saudi Arabian businesses.