// 新增配置文件
export interface PdfjsAnnotationConfig {
    // PDF 文件配置
    pdf?: {
      url?: string;           // PDF 文件 URL
      blob?: Blob;           // PDF 文件 Blob
      arrayBuffer?: ArrayBuffer; // PDF 文件 ArrayBuffer
      allowUrlParameter?: boolean; // 是否允许 URL 参数覆盖
    };
    
    // 批注数据配置
    annotations?: {
      getUrl?: string;        // 获取批注数据 URL
      postUrl?: string;       // 保存批注数据 URL
      autoLoad?: boolean;     // 是否自动加载批注
    };
    
    // 用户配置
    user?: {
      username?: string;      // 用户名
      defaultEditorActive?: string; // 默认激活的编辑工具
      defaultSidebarOpen?: boolean; // 默认侧边栏状态
    };
    
    // 安全配置
    security?: {
      allowedDomains?: string[]; // 允许的域名白名单
      maxFileSize?: number;     // 最大文件大小 (bytes)
      allowedFileTypes?: string[]; // 允许的文件类型
    };
  }
  
  // 全局配置接口
  export interface PdfjsAnnotationExtensionAPI {
    // 配置方法
    configure(config: PdfjsAnnotationConfig): void;
    
    // PDF 加载方法
    loadPdf(url: string): Promise<void>;
    loadPdfFromBlob(blob: Blob): Promise<void>;
    loadPdfFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<void>;
    
    // 批注数据方法
    loadAnnotations(url: string): Promise<void>;
    saveAnnotations(url: string, data: any): Promise<void>;
    
    // 获取实例
    getInstance(): PdfjsAnnotationExtension;
  }