import React, { useState } from "react";
import { read, utils } from "xlsx";
import { PDFDocument } from "pdf-lib";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import PDFViewer from "./components/PDFViewer";
import type { FieldMapping, ExcelData } from "./types";
import fontkit from "@pdf-lib/fontkit";

function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [customFilename, setCustomFilename] = useState("");
  const [selectedFilenameFields, setSelectedFilenameFields] = useState<
    string[]
  >([]);

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

      // Create array to store all PDF data
      const pdfsToDownload = [];

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

        // Draw text for all mappings
        await Promise.all(
          mappings.map(async (mapping) => {
            const page = pages[mapping.page - 1];
            if (!page) {
              console.error(`Page ${mapping.page} not found`);
              return;
            }
            const { height } = page.getSize();
            const value = String(row[mapping.field] || "");

            // Calculate text width
            const textWidth = customFont.widthOfTextAtSize(value, 10);

            await page.drawText(value, {
              x: mapping.x - textWidth / 2, // Center the text by subtracting half of text width
              y: height - mapping.y - 5,
              font: customFont,
              size: 10,
            });
          })
        );

        const modifiedPdfBytes = await newPdf.save();

        // Get the base filename (either custom or excel filename)
        const baseFilename =
          customFilename || excelFile?.name.replace(/\.[^/.]+$/, "") || "";

        // Get values from selected fields
        const fieldValues = selectedFilenameFields
          .map((field) => String(row[field] || ""))
          .filter(Boolean);

        // Combine filename
        const newFilename =
          fieldValues.length > 0
            ? `${baseFilename}-${fieldValues.join("-")}.pdf`
            : `${baseFilename}.pdf`;

        pdfsToDownload.push({
          bytes: modifiedPdfBytes,
          filename: newFilename,
        });
      }

      // Download PDFs with delay
      for (let i = 0; i < pdfsToDownload.length; i++) {
        const { bytes, filename } = pdfsToDownload[i];
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        // Add delay between downloads (500ms)
        if (i < pdfsToDownload.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
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
                    <CloudUploadIcon className="w-12 h-12 text-gray-400" />
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
                    <CloudUploadIcon className="w-12 h-12 text-gray-400" />
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
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-2">
                <label className="text-gray-700">Base Filename:</label>
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder={
                    excelFile?.name.replace(/\.[^/.]+$/, "") || "Enter filename"
                  }
                  className="border rounded px-3 py-1 w-64"
                />
              </div>

              <div className="flex flex-col items-center space-y-2">
                <label className="text-gray-700">Add Fields to Filename:</label>
                <div className="flex flex-wrap gap-2 max-w-xl justify-center">
                  {selectedFilenameFields.map((field, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 bg-gray-100 p-2 rounded"
                    >
                      <select
                        value={field}
                        onChange={(e) => {
                          const newFields = [...selectedFilenameFields];
                          newFields[index] = e.target.value;
                          setSelectedFilenameFields(newFields);
                        }}
                        className="border rounded px-2 py-1"
                      >
                        <option value="">Select Field</option>
                        {excelColumns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          setSelectedFilenameFields((fields) =>
                            fields.filter((_, i) => i !== index)
                          );
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setSelectedFilenameFields([...selectedFilenameFields, ""])
                    }
                    className="bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    + Add Field
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={generatePDFs}
              disabled={selectedFilenameFields.some((field) => !field)}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDownloadIcon className="w-5 h-5" />
              <span>Generate PDFs</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
