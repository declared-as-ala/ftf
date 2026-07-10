'use client';

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (newPage: number) => void;
  };
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  isLoading = false,
  pagination,
}: DataTableProps<T>) {
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;
  const hasPrevious = pagination ? pagination.page > 1 : false;
  const hasNext = pagination ? pagination.page < totalPages : false;

  return (
    <div className="rounded-md border bg-card">
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="border-b transition-colors hover:bg-muted/50">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`h-10 px-4 text-left align-middle font-medium text-muted-foreground ${
                    col.className || ''
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Chargement des données...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Aucun résultat trouvé.
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => (
                <tr
                  key={rowIdx}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`border-b transition-colors hover:bg-muted/50 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, colIdx) => {
                    let content: ReactNode = '';
                    if (col.cell) {
                      content = col.cell(item);
                    } else if (col.accessorKey) {
                      const val = (item as any)[col.accessorKey];
                      content = val !== undefined && val !== null ? String(val) : '';
                    }

                    return (
                      <td
                        key={colIdx}
                        className={`p-4 align-middle ${col.className || ''}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Affichage de {((pagination.page - 1) * pagination.limit) + 1} à{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total} éléments
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => hasPrevious && pagination.onPageChange(pagination.page - 1)}
              disabled={!hasPrevious}
              className="inline-flex items-center justify-center rounded-md border h-8 w-8 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-foreground">
              Page {pagination.page} sur {totalPages}
            </span>
            <button
              onClick={() => hasNext && pagination.onPageChange(pagination.page + 1)}
              disabled={!hasNext}
              className="inline-flex items-center justify-center rounded-md border h-8 w-8 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
