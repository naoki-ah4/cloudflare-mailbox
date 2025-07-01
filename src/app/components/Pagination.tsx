import { useSearchParams } from "react-router";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange?: (page: number) => void;
}

const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalItems, 
  itemsPerPage,
  onPageChange 
}: PaginationProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    
    if (onPageChange) {
      onPageChange(page);
    } else {
      // URLパラメータでページ変更
      const params = new URLSearchParams(searchParams);
      if (page === 1) {
        params.delete("page");
      } else {
        params.set("page", page.toString());
      }
      setSearchParams(params);
    }
  };

  // ページ番号の配列を生成
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const maxVisible = 7; // 表示する最大ページ数

    if (totalPages <= maxVisible) {
      // 総ページ数が少ない場合はすべて表示
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 多い場合は省略表示
      pages.push(1);
      
      if (currentPage <= 4) {
        // 現在ページが前の方の場合
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // 現在ページが後ろの方の場合
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // 現在ページが中間の場合
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null; // ページが1ページ以下の場合は表示しない
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
      <div className="flex items-center justify-between">
        {/* アイテム数表示 */}
        <div className="flex items-center text-sm text-gray-700">
          <p>
            <span className="font-medium">{startItem}</span>
            {" - "}
            <span className="font-medium">{endItem}</span>
            {" / "}
            <span className="font-medium">{totalItems}</span>
            件のメール
          </p>
        </div>

        {/* ページネーション */}
        <div className="flex items-center space-x-2">
          {/* 前のページ */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            前
          </button>

          {/* ページ番号 */}
          <div className="hidden md:flex space-x-1">
            {getPageNumbers().map((page, index) => (
              page === "..." ? (
                <span 
                  key={`ellipsis-${index}`}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700"
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`relative inline-flex items-center px-3 py-2 text-sm font-medium border ${
                    currentPage === page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          {/* モバイル用ページ表示 */}
          <div className="md:hidden flex items-center">
            <span className="text-sm text-gray-700">
              {currentPage} / {totalPages}
            </span>
          </div>

          {/* 次のページ */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            次
          </button>
        </div>
      </div>

      {/* ページサイズ変更（将来拡張用） */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        1ページあたり {itemsPerPage} 件表示
      </div>
    </div>
  );
};

export default Pagination;