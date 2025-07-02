// 笔记类型枚举
export enum NoteType {
    NOTE = 'note',      // 普通笔记
    FOLDER = 'folder'   // 文件夹
  }
  
  // 扩展的笔记接口
  export interface NoteItem {
    id: string;
    key: string;
    bucket_name: string;
    size: number;
    etag: string;
    content_type: string;
    created_at: string;
    last_modified: string;
      user_metadata: {
    title: string;
    type?: string;       // 'note' 或 'folder'
    parent_id?: string;  // 父级ID，用于构建层级关系（空字符串表示根级）
    order?: string;      // 排序权重（字符串格式）
    is_expanded?: string; // 文件夹是否展开（'true' 或 'false'）
  };
    children?: NoteItem[]; // 子项目（仅在树形结构中）
    level?: number;        // 层级深度
  }
  
  // 文件夹操作接口
  export interface FolderOperation {
    type: 'create' | 'rename' | 'move' | 'delete';
    item: NoteItem;
    parent_id?: string;
    new_title?: string;
  }
  
  // 拖拽操作接口
  export interface DragOperation {
    draggedItem: NoteItem;
    targetItem: NoteItem;
    position: 'before' | 'after' | 'inside';
  }