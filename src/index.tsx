import './scss/app.scss'

import { EventBus, PDFPageView, PDFViewerApplication } from 'pdfjs'
import { createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeI18n } from './locale/index'
import { SyncOutlined } from '@ant-design/icons';
import i18n, { t } from 'i18next'
import { CustomPopbar, CustomPopbarRef } from './components/popbar'
import { CustomToolbar, CustomToolbarRef } from './components/toolbar'
import { annotationDefinitions, HASH_PARAMS_DEFAULT_EDITOR_ACTIVE, HASH_PARAMS_DEFAULT_SIDEBAR_OPEN, HASH_PARAMS_GET_URL, HASH_PARAMS_POST_URL, HASH_PARAMS_USERNAME } from './const/definitions'
import { Painter } from './painter'
import { CustomComment, CustomCommentRef } from './components/comment'
import { once, parseQueryString, hashArrayOfObjects } from './utils/utils'
import { defaultOptions } from './const/default_options'
import { exportAnnotationsToExcel, exportAnnotationsToPdf } from './annot'
import { Modal, Space, message } from 'antd'
import { CustomAnnotationMenu, CustomAnnotationMenuRef } from './components/menu'
import { ConnectorLine } from './painter/connectorLine'
//用于配置扩展的类型
import { PdfjsAnnotationConfig, PdfjsAnnotationExtensionAPI } from './type/configuration'
interface AppOptions {
    [key: string]: string;
}

/**
 * PDF.js 扩展类，用于添加 PDF.js 的批注功能
 */
class PdfjsAnnotationExtension {
    // PDF.js 相关对象和引用
    PDFJS_PDFViewerApplication: PDFViewerApplication // PDF.js 的 PDFViewerApplication 对象
    PDFJS_EventBus: EventBus // PDF.js 的 EventBus 对象
    $PDFJS_outerContainer: HTMLDivElement
    $PDFJS_mainContainer: HTMLDivElement
    $PDFJS_sidebarContainer: HTMLDivElement // PDF.js 侧边栏容器
    $PDFJS_toolbar_container: HTMLDivElement // PDF.js 工具栏容器
    $PDFJS_viewerContainer: HTMLDivElement // PDF.js 页面视图容器
    // 自定义组件引用
    customToolbarRef: React.RefObject<CustomToolbarRef> // 自定义工具栏的引用
    customPopbarRef: React.RefObject<CustomPopbarRef>
    customerAnnotationMenuRef: React.RefObject<CustomAnnotationMenuRef> // 自定义批注菜单的引用
    customCommentRef: React.RefObject<CustomCommentRef>
    // 其他实例和状态
    painter: Painter // 画笔实例
    appOptions: AppOptions // 应用选项配置
    loadEnd: Boolean // 加载状态标志
    initialDataHash: number // 初始数据哈希值
    _connectorLine: ConnectorLine | null = null // 连接线实例
    //用于扩展
    private config: PdfjsAnnotationConfig = {};
    private isConfigured: boolean = false;
    private isClickFlag: string = '';
    // 新增：钩子回调函数
    private onDataChangeCallback: ((data: any[]) => void) | null = null;
    private onDataChangeInterval: number | null = null;
    private lastDataHash: number | null = null;
    /**
     * 构造函数，初始化 PDF.js 扩展实例
     */
    constructor() {
        this.loadEnd = false
        this.initialDataHash = null
        // 初始化 PDF.js 对象和相关属性
        this.PDFJS_PDFViewerApplication = (window as any).PDFViewerApplication
        this.PDFJS_EventBus = this.PDFJS_PDFViewerApplication.eventBus
        this.$PDFJS_sidebarContainer = this.PDFJS_PDFViewerApplication.appConfig.sidebar.sidebarContainer
        this.$PDFJS_toolbar_container = this.PDFJS_PDFViewerApplication.appConfig.toolbar.container
        this.$PDFJS_viewerContainer = this.PDFJS_PDFViewerApplication.appConfig.viewerContainer
        this.$PDFJS_mainContainer = this.PDFJS_PDFViewerApplication.appConfig.mainContainer
        this.$PDFJS_outerContainer = this.PDFJS_PDFViewerApplication.appConfig.sidebar.outerContainer
        // 使用 createRef 方法创建 React 引用
        this.customToolbarRef = createRef<CustomToolbarRef>()
        this.customPopbarRef = createRef<CustomPopbarRef>()
        this.customerAnnotationMenuRef = createRef<CustomAnnotationMenuRef>()
        this.customCommentRef = createRef<CustomCommentRef>()
        // 加载多语言
        initializeI18n(this.PDFJS_PDFViewerApplication.l10n.getLanguage())
        // 初始化应用选项
        this.appOptions = {
            [HASH_PARAMS_USERNAME]: i18n.t('normal.unknownUser'), // 默认用户名,
            [HASH_PARAMS_GET_URL]: defaultOptions.setting.HASH_PARAMS_GET_URL, // 默认 GET URL
            [HASH_PARAMS_POST_URL]: defaultOptions.setting.HASH_PARAMS_POST_URL, // 默认 POST URL
            [HASH_PARAMS_DEFAULT_EDITOR_ACTIVE]: defaultOptions.setting.HASH_PARAMS_DEFAULT_EDITOR_ACTIVE,
            [HASH_PARAMS_DEFAULT_SIDEBAR_OPEN]: defaultOptions.setting.HASH_PARAMS_DEFAULT_SIDEBAR_OPEN,
        };
        console.log("初始化应用选项---->",this.appOptions);
        // 处理地址栏参数
        this.parseHashParams()
        // 创建画笔实例
        this.painter = new Painter({
            userName: this.getOption(HASH_PARAMS_USERNAME),
            PDFViewerApplication: this.PDFJS_PDFViewerApplication,
            PDFJS_EventBus: this.PDFJS_EventBus,
            // 设置默认模式的函数
            setDefaultMode: () => {
                // 通过当前引用调用工具栏的activeAnnotation方法
                // 并传入注释定义数组的第一个元素作为参数
                console.log('setDefaultMode-问问-1--------------->', annotationDefinitions[0],annotationDefinitions)
                this.customToolbarRef.current.activeAnnotation(null)
            },
            onWebSelectionSelected: range => {
                console.log('onWebSelectionSelected----问问-2------------>', range)
                this.customPopbarRef.current.open(range)
            },
            onStoreAdd: (annotation, isOriginal, currentAnnotation) => {
                console.log('onStoreAdd--------问问--3------->', annotation, isOriginal, currentAnnotation)
                this.customCommentRef.current.addAnnotation(annotation)
                if (isOriginal) return
                if (currentAnnotation.isOnce) {
                    this.painter.selectAnnotation(annotation.id)
                }
                if (this.isCommentOpen()) {
                    // 如果评论栏已打开，则选中批注
                    this.customCommentRef.current.selectedAnnotation(annotation, true)
                }
            },
            onStoreDelete: (id) => {
                console.log('onStoreDelete------问问-4---------->', id)
                this.customCommentRef.current.delAnnotation(id)
            },
            onAnnotationSelected: (annotation, isClick, selectorRect) => {
                console.log('onAnnotationSelected------问问--5--------->', annotation, isClick, selectorRect)
                this.customerAnnotationMenuRef.current.open(annotation, selectorRect)
                if (isClick && this.isCommentOpen()) {
                    // 如果是点击事件并且评论栏已打开，则选中批注
                    this.customCommentRef.current.selectedAnnotation(annotation, isClick)
                }

                this.connectorLine?.drawConnection(annotation, selectorRect)
            },
            onAnnotationChange: (annotation) => {
                console.log('onAnnotationChange------问问---6-------->', annotation)
                this.customCommentRef.current.updateAnnotation(annotation)
            },
            onAnnotationChanging: (id,isClick) => {
                console.log('onAnnotationChanging------问问---7-------->',this.customToolbarRef.current)
                this.connectorLine?.clearConnection()
                this.customerAnnotationMenuRef?.current?.close()
                // let ff = this.customToolbarRef.current.currentAnnotation;
                // console.log("fffffffffffffffffffffffff",ff,isClick,id)
                // this.isClickFlag = this.isClickFlag + id;
                // setTimeout(() => {
                //     console.log("this.isClickFlag",this.isClickFlag)
                //     if(this.isClickFlag === '41'){
                //         this.isClickFlag = '';
                //     }else if(this.isClickFlag === '441'){
                //         this.isClickFlag = '';
                //     }else if(this.isClickFlag === '4'){
                //         // this.isClickFlag = '';
                //     }else if(this.isClickFlag!== ''&&ff&&ff.name == 'select'){
                //          this.isClickFlag = '';
                //           this.customToolbarRef.current.activeAnnotation(null);
                //     }
                    
                //     this.isClickFlag = '';
                // },500)
            },
            onAnnotationChanged: (annotation, selectorRect) => {
                console.log('annotation changed------问问--8--------->', annotation)
                this.connectorLine?.drawConnection(annotation, selectorRect)
                this.customerAnnotationMenuRef?.current?.open(annotation, selectorRect)
            },
        })
        // 初始化操作
        this.init()
        // 检查是否有预配置deng 25/09/28
        // this.checkPreConfiguration(); 方法一先隐藏
    }
 
     /**
     * 配置扩展实例 deng 25/09/28 start
     */
     public configure(config: PdfjsAnnotationConfig): void {
        this.config = { ...this.config, ...config };
        this.isConfigured = true;
        
        // 应用配置
        this.applyConfiguration();
    }

    /**
     * 安全加载 PDF 文件
     */
    public async loadPdf(url: string): Promise<void> {
        // if (!this.validateUrl(url)) {
        //     throw new Error('不安全的 URL 或不在允许的域名列表中');
        // }
        let args = { url : url }
        try {
            await this.PDFJS_PDFViewerApplication.open(args);
        } catch (error) {
            console.error('PDF 加载失败1:', error);
            throw error;
        }
    }

    /**
     * 从 Blob 加载 PDF
     */
    public async loadPdfFromBlob(blob: Blob): Promise<void> {
        if (!this.validateFileSize(blob.size)) {
            throw new Error('文件大小超出限制');
        }
        
        const url = URL.createObjectURL(blob);
        try {
            await this.loadPdf(url);
        } finally {
            // 清理临时 URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    /**
     * 从 ArrayBuffer 加载 PDF
     */
    public async loadPdfFromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
        if (!this.validateFileSize(arrayBuffer.byteLength)) {
            throw new Error('文件大小超出限制');
        }
        
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        await this.loadPdfFromBlob(blob);
    }

    /**
     * 加载批注数据
     */
    public async loadAnnotations(url: string): Promise<void> {
        if (!this.validateUrl(url)) {
            throw new Error('不安全的批注数据 URL');
        }
        
        // 更新配置中的 GET URL
        this.config.annotations = { ...this.config.annotations, getUrl: url };
        this.setOption(HASH_PARAMS_GET_URL, url);
        
        // 重新加载批注数据
        const data = await this.getData();
        // defaultOptions.setting.LOAD_PDF_ANNOTATION 属性值用于是否加载 pdf 原有批注
        await this.painter.initAnnotations(data, defaultOptions.setting.LOAD_PDF_ANNOTATION);
    }

    /**
     * 保存批注数据
     */
    public async saveAnnotations(url: string, data: any): Promise<void> {
        if (!this.validateUrl(url)) {
            throw new Error('不安全的保存 URL');
        }
        
        // 更新配置中的 POST URL
        this.config.annotations = { ...this.config.annotations, postUrl: url };
        this.setOption(HASH_PARAMS_POST_URL, url);
        
        // 执行保存
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        
        if (!response.ok) {
            throw new Error(`保存失败: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * 获取实例
     */
    public getInstance(): PdfjsAnnotationExtension {
        return this;
    }

    /**
     * 验证 URL 安全性
     */
    private validateUrl(url: string): boolean {
        if (!this.config.security?.allowedDomains) {
            return true; // 如果没有配置域名限制，则允许所有
        }
        
        try {
            const urlObj = new URL(url);
            return this.config.security.allowedDomains.some(domain => 
                urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
            );
        } catch {
            return false;
        }
    }

    /**
     * 验证文件大小
     */
    private validateFileSize(size: number): boolean {
        if (!this.config.security?.maxFileSize) {
            return true;
        }
        return size <= this.config.security.maxFileSize;
    }

    /**
     * 应用配置
     */
    private applyConfiguration(): void {
        // 应用 PDF 配置
        if (this.config.pdf?.url && !this.config.pdf?.allowUrlParameter) {
            // 如果配置了 PDF URL 且不允许 URL 参数覆盖，则使用配置的 URL
            this.loadPdf(this.config.pdf.url);
        }
        
        // 应用批注配置
        if (this.config.annotations?.getUrl) {
            this.setOption(HASH_PARAMS_GET_URL, this.config.annotations.getUrl);
        }
        if (this.config.annotations?.postUrl) {
            this.setOption(HASH_PARAMS_POST_URL, this.config.annotations.postUrl);
        }
        console.log('应用用户配置----000--------->', this.config.user.username)
        // 应用用户配置
        if (this.config.user?.username) {
            console.log('应用用户配置----111111--------->', this.config.user.username)
            this.setOption(HASH_PARAMS_USERNAME, this.config.user.username);
        }
        if (this.config.user?.defaultEditorActive) {
            this.setOption(HASH_PARAMS_DEFAULT_EDITOR_ACTIVE, this.config.user.defaultEditorActive);
        }
        if (this.config.user?.defaultSidebarOpen !== undefined) {
            this.setOption(HASH_PARAMS_DEFAULT_SIDEBAR_OPEN, this.config.user.defaultSidebarOpen.toString());
        }
    }

    /**
     * 检查预配置
     */
    private checkPreConfiguration(): void {
        // 检查是否有全局配置
        if ((window as any).pdfjsAnnotationConfig) {
            this.configure((window as any).pdfjsAnnotationConfig);
        }
    }
    //-----------------------------------------------------------------------------------end
    //-设置数据变化钩子----------------------------------------------------------------------------------srat
        /**
     * 设置数据变化钩子
     * @param callback 数据变化时的回调函数
     * @param options 配置选项
     */
        public setDataChangeHook(
            callback: (data: any[]) => void, 
            options: {
                immediate?: boolean;        // 是否立即执行一次
                debounce?: number;         // 防抖延迟（毫秒）
                enableAutoSave?: boolean;  // 是否启用自动保存
            } = {}
        ): void {
            const { immediate = false, debounce = 500, enableAutoSave = false } = options;
            
            this.onDataChangeCallback = callback;
            
            // 清除之前的定时器
            if (this.onDataChangeInterval) {
                clearInterval(this.onDataChangeInterval);
            }
            
            // 设置数据变化监听
            this.onDataChangeInterval = window.setInterval(() => {
                this.checkDataChange(debounce, enableAutoSave);
            }, 100); // 每100ms检查一次
            
            // 立即执行一次
            if (immediate) {
                const currentData = this.painter.getData();
                callback(currentData);
            }
        }
    
        /**
         * 移除数据变化钩子
         */
        public removeDataChangeHook(): void {
            this.onDataChangeCallback = null;
            if (this.onDataChangeInterval) {
                clearInterval(this.onDataChangeInterval);
                this.onDataChangeInterval = null;
            }
        }
    
        /**
         * 检查数据是否发生变化
         */
        private checkDataChange(debounce: number, enableAutoSave: boolean): void {
            if (!this.onDataChangeCallback) return;
            
            const currentData = this.painter.getData();
            const currentHash = hashArrayOfObjects(currentData);
            
            // 如果数据发生变化
            if (this.lastDataHash !== currentHash) {
                this.lastDataHash = currentHash;
                
                // 防抖处理
                if (this.dataChangeTimeout) {
                    clearTimeout(this.dataChangeTimeout);
                }
                
                this.dataChangeTimeout = setTimeout(() => {
                    if (this.onDataChangeCallback) {
                        this.onDataChangeCallback(currentData);
                    }
                    
                    // 如果启用自动保存
                    if (enableAutoSave) {
                        this.autoSaveData(currentData);
                    }
                }, debounce);
            }
        }
    
        private dataChangeTimeout: number | null = null;
    
        /**
         * 自动保存数据
         */
        private async autoSaveData(data: any[]): Promise<void> {
            const postUrl = this.getOption(HASH_PARAMS_POST_URL);
            if (!postUrl) return;
            
            try {
                await fetch(postUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                console.log('自动保存成功');
            } catch (error) {
                console.error('自动保存失败:', error);
            }
        }
    
        /**
         * 手动获取当前批注数据
         * @returns 当前所有批注数据
         */
        public getCurrentAnnotations(): any[] {
            return this.painter.getData();
        }
    
        /**
         * 获取批注数据统计信息
         * @returns 批注统计信息
         */
        public getAnnotationsStats(): {
            total: number;
            byType: Record<string, number>;
            byUser: Record<string, number>;
            lastModified: Date;
        } {
            const data = this.painter.getData();
            const stats = {
                total: data.length,
                byType: {} as Record<string, number>,
                byUser: {} as Record<string, number>,
                lastModified: new Date()
            };
    
            data.forEach(annotation => {
                // 按类型统计
                const type = annotation.type || 'unknown';
                stats.byType[type] = (stats.byType[type] || 0) + 1;
                
                // 按用户统计
                const user = annotation.userName || 'unknown';
                stats.byUser[user] = (stats.byUser[user] || 0) + 1;
            });
    
            return stats;
        }
    
        /**
         * 监听特定类型的批注变化
         * @param type 批注类型
         * @param callback 回调函数
         */
        public watchAnnotationType(
            type: string, 
            callback: (annotations: any[]) => void
        ): () => void {
            const originalCallback = this.onDataChangeCallback;
            
            this.setDataChangeHook((data) => {
                const filteredData = data.filter(annotation => annotation.type === type);
                callback(filteredData);
                
                // 调用原始回调
                if (originalCallback) {
                    originalCallback(data);
                }
            });
            
            // 返回取消监听的函数
            return () => {
                this.setDataChangeHook(originalCallback);
            };
        }
    
        /**
         * 批量操作批注数据
         * @param operations 操作数组
         */
        public batchOperations(operations: Array<{
            type: 'add' | 'update' | 'delete';
            data?: any;
            id?: string;
        }>): void {
            operations.forEach(operation => {
                switch (operation.type) {
                    case 'add':
                        if (operation.data) {
                            this.painter.addAnnotation(operation.data);
                        }
                        break;
                    case 'update':
                        if (operation.id && operation.data) {
                            this.painter.update(operation.id, operation.data);
                        }
                        break;
                    case 'delete':
                        if (operation.id) {
                            this.painter.delete(operation.id);
                        }
                        break;
                }
            });
        }
        /**
         * 清理资源
         */
        public destroy(): void {
            this.removeDataChangeHook();
            if (this.dataChangeTimeout) {
                clearTimeout(this.dataChangeTimeout);
            }
        }
        //设置数据变化钩子-----------------------------------------------------------end

    get connectorLine(): ConnectorLine | null {
        if (defaultOptions.connectorLine.ENABLED) {
            this._connectorLine = new ConnectorLine({})
        }
        return this._connectorLine
    }

    /**
     * @description 初始化 PdfjsAnnotationExtension 类
     */
    private init(): void {
        this.addCustomStyle()
        this.bindPdfjsEvents()
        this.renderToolbar()
        this.renderPopBar()
        this.renderAnnotationMenu()
        this.renderComment()
    }

    /**
     * @description 处理地址栏参数
     * @returns 
     */
    private parseHashParams() {
        const hash = document.location.hash.substring(1);
        if (!hash) {
            console.warn(`HASH_PARAMS is undefined`);
            return;
        }
        const params = parseQueryString(hash);
        if (params.has(HASH_PARAMS_USERNAME)) {
            this.setOption(HASH_PARAMS_USERNAME, params.get(HASH_PARAMS_USERNAME))
        } else {
            console.warn(`${HASH_PARAMS_USERNAME} is undefined`);
        }
        if (params.has(HASH_PARAMS_GET_URL)) {
            this.setOption(HASH_PARAMS_GET_URL, params.get(HASH_PARAMS_GET_URL))
        } else {
            console.warn(`${HASH_PARAMS_GET_URL} is undefined`);
        }
        if (params.has(HASH_PARAMS_POST_URL)) {
            this.setOption(HASH_PARAMS_POST_URL, params.get(HASH_PARAMS_POST_URL))
        } else {
            console.warn(`${HASH_PARAMS_POST_URL} is undefined`);
        }
        if (params.has(HASH_PARAMS_DEFAULT_EDITOR_ACTIVE) && params.get(HASH_PARAMS_DEFAULT_EDITOR_ACTIVE) === 'true') {
            this.setOption(HASH_PARAMS_DEFAULT_EDITOR_ACTIVE, 'select')
        } else {
            console.warn(`${HASH_PARAMS_DEFAULT_EDITOR_ACTIVE} is undefined`);
        }

        if (params.has(HASH_PARAMS_DEFAULT_SIDEBAR_OPEN) && params.get(HASH_PARAMS_DEFAULT_SIDEBAR_OPEN) === 'false') {
            this.setOption(HASH_PARAMS_DEFAULT_SIDEBAR_OPEN, 'false')
        } else {
            console.warn(`${HASH_PARAMS_DEFAULT_EDITOR_ACTIVE} is undefined`);
        }

    }

    private setOption(name: string, value: string) {
        this.appOptions[name] = value
    }

    private getOption(name: string) {
        console.log('getOption来了-->', this.appOptions,this.appOptions[name],name)
        return this.appOptions[name]
    }

    /**
     * @description 添加自定义样式
     */
    private addCustomStyle(): void {
        document.body.classList.add('PdfjsAnnotationExtension')
        this.toggleComment(this.getOption(HASH_PARAMS_DEFAULT_SIDEBAR_OPEN) === 'true')
    }

    /**
     * @description 切换评论栏的显示状态
     * @param open 
     */
    private toggleComment(open: boolean): void {
        if (open) {
            document.body.classList.remove('PdfjsAnnotationExtension_Comment_hidden')
        } else {
            document.body.classList.add('PdfjsAnnotationExtension_Comment_hidden')
        }
    }

    /**
     * @description 检查评论栏是否打开
     * @returns 
     */
    private isCommentOpen(): boolean {
        return !document.body.classList.contains('PdfjsAnnotationExtension_Comment_hidden')
    }

    /**
     * @description 渲染自定义工具栏
     */
    /**
     * 渲染工具栏组件
     * 该方法负责创建工具栏DOM元素并渲染自定义工具栏组件
     */
    private renderToolbar(): void {
        // 创建工具栏的div元素
        const toolbar = document.createElement('div')
        // 将工具栏元素插入到PDFJS工具栏容器的后面
        this.$PDFJS_toolbar_container.insertAdjacentElement('afterend', toolbar)
        // 使用React 18的createRoot API创建根节点并渲染自定义工具栏组件
        createRoot(toolbar).render(
            // 渲染CustomToolbar组件，并传递相关属性和回调函数
            <CustomToolbar
                // 设置工具栏引用
                ref={this.customToolbarRef}
                // 设置默认注释名称，从配置选项中获取
                defaultAnnotationName={this.getOption(HASH_PARAMS_DEFAULT_EDITOR_ACTIVE)}
                // 设置默认侧边栏是否打开，从配置选项中获取并转换为布尔值
                defaultSidebarOpen={this.getOption(HASH_PARAMS_DEFAULT_SIDEBAR_OPEN) === 'true'}
                // 设置用户名，从配置选项中获取
                userName={this.getOption(HASH_PARAMS_USERNAME)}
                // 注释变更回调函数
                onChange={(currentAnnotation, dataTransfer) => {
                    // 激活指定的注释并处理数据传输
                    console.log('onChange---注释变更回调函数-------->', currentAnnotation, dataTransfer)
                    this.painter.activate(currentAnnotation, dataTransfer)
                }}
                // 保存回调函数
                onSave={() => {
                    // 保存当前数据
                    this.saveData()
                }}
                // 导出回调函数，支持导出为Excel或PDF
                onExport={async (type) => {
                    // 如果导出类型为Excel，则执行Excel导出
                    if (type === 'excel') {
                        this.exportExcel()
                        return
                    }
                    // 如果导出类型为PDF，则执行PDF导出
                    if (type === 'pdf') {
                        await this.exportPdf()
                        return
                    }
                }}
                // 侧边栏开关回调函数
                onSidebarOpen={(isOpen) => {
                    // 切换评论显示状态
                    this.toggleComment(isOpen)
                    this.connectorLine.clearConnection()
                }}
            />
        )
    }

    /**
     * @description 渲染自定义弹出工具条
     */
    private renderPopBar(): void {
        const popbar = document.createElement('div')
        this.$PDFJS_viewerContainer.insertAdjacentElement('afterend', popbar)
        createRoot(popbar).render(
            <CustomPopbar
                ref={this.customPopbarRef}
                onChange={(currentAnnotation, range) => {
                    this.painter.highlightRange(range, currentAnnotation)
                }}
            />
        )
    }

    /**
     * @description 渲染自定义弹出工具条
     */
    private renderAnnotationMenu(): void {
        const annotationMenu = document.createElement('div')
        this.$PDFJS_outerContainer.insertAdjacentElement('afterend', annotationMenu)
        createRoot(annotationMenu).render(
            <CustomAnnotationMenu
                ref={this.customerAnnotationMenuRef}
                onOpenComment={(currentAnnotation) => {
                    this.toggleComment(true)
                    this.customToolbarRef.current.toggleSidebarBtn(true)
                    setTimeout(() => {
                        this.customCommentRef.current.selectedAnnotation(currentAnnotation, true)
                    }, 100)
                }}
                onChangeStyle={(currentAnnotation, style) => {
                    this.painter.updateAnnotationStyle(currentAnnotation, style)
                    this.customToolbarRef.current.updateStyle(currentAnnotation.type, style)
                }}
                onDelete={(currentAnnotation) => {
                    this.painter.delete(currentAnnotation.id, true)
                }}
            />
        )
    }

    /**
     * @description 渲染自定义留言条
     */
    private renderComment(): void {
        const comment = document.createElement('div')
        this.$PDFJS_mainContainer.insertAdjacentElement('afterend', comment)
        createRoot(comment).render(
            <CustomComment
                ref={this.customCommentRef}
                userName={this.getOption(HASH_PARAMS_USERNAME)}
                onSelected={async (annotation) => {
                    await this.painter.highlight(annotation)
                }}
                onDelete={(id) => {
                    this.painter.delete(id)
                }}
                onUpdate={(annotation) => {
                    this.painter.update(annotation.id, {
                        title: annotation.title,
                        contentsObj: annotation.contentsObj,
                        comments: annotation.comments
                    })
                }}
                onScroll={() => {
                    this.connectorLine?.clearConnection()
                }}
                onSave={() => {
                    // 保存当前数据
                    this.saveData()
                }}
            />
        )
    }

    /**
     * @description 隐藏 PDF.js 编辑模式按钮
     */
    private hidePdfjsEditorModeButtons(): void {
        defaultOptions.setting.HIDE_PDFJS_ELEMENT.forEach(item => {
            const element = document.querySelector(item) as HTMLElement;
            if (element) {
                element.style.display = 'none';
                const nextDiv = element.nextElementSibling as HTMLElement;
                if (nextDiv.classList.contains('horizontalToolbarSeparator')) {
                    nextDiv.style.display = 'none'
                }
            }
        });
    }

    /**
     * 更新PDF.js的显示缩放
     * 该方法用于临时调整PDF查看器的缩放级别，然后恢复原始缩放值
     */
    private updatePdfjs() {
        // 获取当前PDF查看器的缩放值
        const currentScaleValue = this.PDFJS_PDFViewerApplication.pdfViewer.currentScaleValue
        // 检查当前缩放值是否为自动、适应页面或适应页面宽度
        if (
            currentScaleValue === 'auto' ||
            currentScaleValue === 'page-fit' ||
            currentScaleValue === 'page-width'
        ) {
            // 如果是上述三种缩放模式之一，则临时设置为80%缩放
            this.PDFJS_PDFViewerApplication.pdfViewer.currentScaleValue = '0.8'
            // 更新PDF查看器以应用新的缩放值
            this.PDFJS_PDFViewerApplication.pdfViewer.update()
        } else {
            // 如果不是上述三种缩放模式，则设置为自动缩放
            this.PDFJS_PDFViewerApplication.pdfViewer.currentScaleValue = 'auto'
            // 更新PDF查看器以应用新的缩放值
            this.PDFJS_PDFViewerApplication.pdfViewer.update()
        }
        // 无论之前如何，最后都恢复原始缩放值
        this.PDFJS_PDFViewerApplication.pdfViewer.currentScaleValue = currentScaleValue
        // 再次更新PDF查看器以恢复原始缩放值
        this.PDFJS_PDFViewerApplication.pdfViewer.update()
    }

    /**
     * @description 绑定 PDF.js 相关事件
     */
    private bindPdfjsEvents(): void {
        this.hidePdfjsEditorModeButtons()
        const setLoadEnd = once(() => {
            this.loadEnd = true
        })

        // 视图更新时隐藏菜单
        this.PDFJS_EventBus._on('updateviewarea', () => {
            this.customerAnnotationMenuRef.current?.close()
            this.connectorLine?.clearConnection()
        })

        // 监听页面渲染完成事件
        this.PDFJS_EventBus._on(
            'pagerendered',
            async ({ source, cssTransform, pageNumber }: { source: PDFPageView; cssTransform: boolean; pageNumber: number }) => {
                setLoadEnd()
                this.painter.initCanvas({ pageView: source, cssTransform, pageNumber })
            }
        )

        // 监听文档加载完成事件
        this.PDFJS_EventBus._on('documentloaded', async () => {
            this.painter.initWebSelection(this.$PDFJS_viewerContainer)
            const data = await this.getData()
            this.initialDataHash = hashArrayOfObjects(data)
            console.log('data来了-->', this.initialDataHash)
            await this.painter.initAnnotations(data, defaultOptions.setting.LOAD_PDF_ANNOTATION)
            if (this.loadEnd) {
                this.updatePdfjs()
            }
        })
    }

    /**
     * @description 获取外部批注数据
     * @returns 
     */
    private async getData(): Promise<any[]> {
        const getUrl = this.getOption(HASH_PARAMS_GET_URL);
        if (!getUrl) {
            return [];
        }
        try {
            message.open({
                type: 'loading',
                content: t('normal.processing'),
                duration: 0,
            });
            const response = await fetch(getUrl, { method: 'GET' });

            if (!response.ok) {
                const errorMessage = `HTTP Error ${response.status}: ${response.statusText || 'Unknown Status'}`;
                throw new Error(errorMessage);
            }
            return await response.json();
        } catch (error) {
            Modal.error({
                content: t('load.fail', { value: error?.message }),
                closable: false,
                okButtonProps: {
                    loading: false
                },
                okText: t('normal.ok')
            })
            console.error('Fetch error:', error);
            return [];
        } finally {
            message.destroy();
        }
    }

    /**
     * @description 保存批注数据
     * @returns 
     */
    private async saveData(): Promise<void> {
        const dataToSave = this.painter.getData();
        console.log('%c [ dataToSave ]', 'font-size:13px; background:#d10d00; color:#ff5144;', dataToSave);
        console.log('HASH_PARAMS_POST_URL来了-->', HASH_PARAMS_POST_URL)
        const postUrl = this.getOption(HASH_PARAMS_POST_URL);
        console.log('postUrl111111111l来了-->', postUrl)
        if (!postUrl) {
            console.log('postUr222222来了-->', postUrl)
            message.error({
                content: t('save.noPostUrl', { value: HASH_PARAMS_POST_URL }),
                key: 'save',
            });
            return;
        }
        const modal = Modal.info({
            content: <Space><SyncOutlined spin />{t('save.start')}</Space>,
            closable: false,
            okButtonProps: {
                loading: true
            },
            okText: t('normal.ok')
        })
        try {
            const response = await fetch(postUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave),
            });
            if (!response.ok) {
                throw new Error(`Failed to save PDF. Status: ${response.status} ${response.statusText}`);
            }
            const result = await response.json();
            // {"status": "ok", "message": "POST received!"}
            this.initialDataHash = hashArrayOfObjects(dataToSave)
            modal.destroy()
            message.success({
                content: t('save.success'),
                key: 'save',
            });
            console.log('Saved successfully:', result);
        } catch (error) {
            modal.update({
                type: 'error',
                content: t('save.fail', { value: error?.message }),
                closable: true,
                okButtonProps: {
                    loading: false
                },
            })
            console.error('Error while saving data:', error);
        }
    }

    private async exportPdf() {
        const dataToSave = this.painter.getData();
        const modal = Modal.info({
            title: t('normal.export'),
            content: <Space><SyncOutlined spin />{t('normal.processing')}</Space>,
            closable: false,
            okButtonProps: {
                loading: true
            },
            okText: t('normal.ok')
        })
        await exportAnnotationsToPdf(this.PDFJS_PDFViewerApplication, dataToSave)
        modal.update({
            type: 'success',
            title: t('normal.export'),
            content: t('pdf.generationSuccess'),
            closable: true,
            okButtonProps: {
                loading: false
            },
        })
    }

    private async exportExcel() {
        const annotations = this.painter.getData()
        await exportAnnotationsToExcel(this.PDFJS_PDFViewerApplication, annotations)
        Modal.info({
            type: 'success',
            title: t('normal.export'),
            content: t('pdf.generationSuccess'),
            closable: true,
            okButtonProps: {
                loading: false
            },
        })
    }

    public hasUnsavedChanges(): boolean {
        return hashArrayOfObjects(this.painter.getData()) !== this.initialDataHash
    }

}

declare global {
    interface Window {
        pdfjsAnnotationExtensionInstance: PdfjsAnnotationExtension
    }
}

window.pdfjsAnnotationExtensionInstance = new PdfjsAnnotationExtension()