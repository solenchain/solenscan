"use client";

interface PaginationProps {
  page: number;
  pageSize: number;
  total?: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, hasMore, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <div className="text-sm text-gray-500">
        {total !== undefined ? (
          <>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}
          </>
        ) : (
          <>Page {page + 1}</>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasMore}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
