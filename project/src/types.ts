export interface FieldMapping {
  x: number;
  y: number;
  field: string;
  page: number;
}

export interface ExcelData {
  [key: string]: string | number;
}