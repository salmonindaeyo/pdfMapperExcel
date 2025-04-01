import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { FieldMapping } from "../types";
import CropFreeIcon from "@mui/icons-material/CropFree";
// Update worker configuration to use local module
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

interface PDFViewerProps {
  pdfFile: File | null;
  onAddMapping: (mapping: FieldMapping) => void;
  onRemoveLastMapping: () => void;
  mappings: FieldMapping[];
  excelColumns: string[];
}

export default function PDFViewer({
  pdfFile,
  onAddMapping,
  onRemoveLastMapping,
  mappings,
  excelColumns,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale] = useState(1.5);
  const [selectedField, setSelectedField] = useState<string>("");
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (!pdfFile) return;

    const loadPDF = async () => {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer })
        .promise;
      setPdf(loadedPdf);
      setTotalPages(loadedPdf.numPages);
      renderPage(1, loadedPdf);
    };

    loadPDF();
  }, [pdfFile]);

  const renderPage = async (pageNumber: number, pdfDoc = pdf) => {
    if (!pdfDoc || !canvasRef.current) return;

    const page = await pdfDoc.getPage(pageNumber);
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const viewport = page.getViewport({ scale });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context!,
      viewport,
    }).promise;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);
    setMousePosition({ x, y });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedField) {
      alert("Please select a field first");
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);
    onAddMapping({
      x,
      y,
      field: selectedField,
      page: currentPage,
    });
  };

  const changePage = async (delta: number) => {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      await renderPage(newPage);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex space-x-4 items-center mb-4">
        <select
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          className="border rounded px-3 py-1"
        >
          <option value="">Select Excel Field</option>
          {excelColumns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
        <div className="flex space-x-2 items-center">
          <div className="text-sm text-gray-600 mr-2">
            Mouse Position - X: {mousePosition.x}, Y: {mousePosition.y}
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => changePage(-1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => changePage(1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
          {mappings.length > 0 && (
            <button
              onClick={onRemoveLastMapping}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Undo Last Point
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onClick={handleCanvasClick}
          className="border shadow-lg cursor-crosshair"
        />
        {mappings
          .filter((m) => m.page === currentPage)
          .map((mapping, index) => (
            <div
              key={index}
              className="absolute"
              style={{
                left: mapping.x * scale,
                top: mapping.y * scale,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="group">
                <CropFreeIcon className="w-6 h-6 text-blue-500" />
                <span className="absolute -top-0 left-6  bg-blue-100 px-2 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {mapping.field}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
