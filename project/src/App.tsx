import React, { useState } from "react";
import { read, utils } from "xlsx";
import { PDFDocument } from "pdf-lib";
import { Upload, Download } from "lucide-react";
import PDFViewer from "./components/PDFViewer";
import type { FieldMapping, ExcelData } from "./types";
import fontkit from "@pdf-lib/fontkit";

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [filenameField, setFilenameField] = useState<string>("");

  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json<ExcelData>(worksheet);
      setExcelData(jsonData);
      setExcelColumns(Object.keys(jsonData[0] || {}));
    }
  };

  const handleAddMapping = (mapping: FieldMapping) => {
    setMappings([...mappings, mapping]);
  };

  const handleRemoveLastMapping = () => {
    setMappings(mappings.slice(0, -1));
  };

  const generatePDFs = async () => {
    if (!pdfFile || !excelData.length || !mappings.length) return;

    try {
      // Load the Noto Sans Thai font
      const fontUrl =
        "https://fonts.gstatic.com/s/notosansthai/v20/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzF-QRvzzXg.ttf";
      const fontBytes = await fetch(fontUrl).then((res) => res.arrayBuffer());

      const pdfBytes = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);

      for (const row of excelData) {
        const newPdf = await PDFDocument.create();
        // Register fontkit
        newPdf.registerFontkit(fontkit);

        // Load all pages from the original PDF
        const pageIndices = Array.from(
          { length: pdfDoc.getPageCount() },
          (_, i) => i
        );
        const existingPdfPages = await newPdf.copyPages(pdfDoc, pageIndices);
        existingPdfPages.forEach((page) => {
          newPdf.addPage(page);
        });

        // Embed font
        const customFont = await newPdf.embedFont(fontBytes, {
          subset: true,
          customName: "NotoSansThai",
        });
        const pages = newPdf.getPages();

        mappings.forEach(async (mapping) => {
          try {
            const page = pages[mapping.page - 1];
            if (!page) {
              console.error(`Page ${mapping.page} not found`);
              return;
            }
            const { height } = page.getSize();
            const value = String(row[mapping.field] || "");

            page.drawText(value, {
              x: mapping.x,
              y: height - mapping.y - 5,
              font: customFont,
              size: 10,
            });
          } catch (error) {
            console.error(`Error processing mapping:`, error);
          }
        });

        // Wait for all text to be drawn before saving
        await Promise.all(
          mappings.map(async (mapping) => {
            const page = pages[mapping.page - 1];
            if (!page) return;
            const { height } = page.getSize();
            const value = String(row[mapping.field] || "");

            await page.drawText(value, {
              x: mapping.x,
              y: height - mapping.y - 5,
              font: customFont,
              size: 10,
            });
          })
        );

        const modifiedPdfBytes = await newPdf.save();
        const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        // Get original filename without extension
        const originalName = pdfFile.name.replace(".pdf", "");
        // Get the value from selected field
        const fieldValue = String(row[filenameField] || "");
        // Combine filename
        const newFilename = `${originalName}-${fieldValue}.pdf`;

        a.download = newFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error generating PDFs:", error);
      alert("Error generating PDFs. Please check the console for details.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          PDF Excel Field Mapper
        </h1>

        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block mb-4">
                <span className="text-gray-700">Upload PDF Template</span>
                <div className="mt-2 flex items-center justify-center w-full px-6 py-8 border-2 border-dashed rounded-lg border-gray-300 cursor-pointer hover:border-gray-400">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePDFUpload}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label
                    htmlFor="pdf-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <Upload className="w-12 h-12 text-gray-400" />
                    <span className="mt-2 text-sm text-gray-500">
                      {pdfFile ? pdfFile.name : "Select PDF file"}
                    </span>
                  </label>
                </div>
              </label>
            </div>

            <div>
              <label className="block mb-4">
                <span className="text-gray-700">Upload Excel Data</span>
                <div className="mt-2 flex items-center justify-center w-full px-6 py-8 border-2 border-dashed rounded-lg border-gray-300 cursor-pointer hover:border-gray-400">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="hidden"
                    id="excel-upload"
                  />
                  <label
                    htmlFor="excel-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <Upload className="w-12 h-12 text-gray-400" />
                    <span className="mt-2 text-sm text-gray-500">
                      {excelFile ? excelFile.name : "Select Excel file"}
                    </span>
                  </label>
                </div>
              </label>
            </div>
          </div>
        </div>

        {pdfFile && excelColumns.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <PDFViewer
              pdfFile={pdfFile}
              onAddMapping={handleAddMapping}
              onRemoveLastMapping={handleRemoveLastMapping}
              mappings={mappings}
              excelColumns={excelColumns}
            />
          </div>
        )}

        {mappings.length > 0 && (
          <div className="flex flex-col items-center space-y-4 mt-8">
            <div className="flex items-center space-x-2">
              <label className="text-gray-700">Filename Field:</label>
              <select
                value={filenameField}
                onChange={(e) => setFilenameField(e.target.value)}
                className="border rounded px-3 py-1"
              >
                <option value="">Select Field</option>
                {excelColumns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={generatePDFs}
              disabled={!filenameField}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              <span>Generate PDFs</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
