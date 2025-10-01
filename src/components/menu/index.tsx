import './index.scss'

import { computePosition, flip } from '@floating-ui/dom'
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { annotationDefinitions, IAnnotationStore, IAnnotationStyle } from '../../const/definitions'
import { IRect } from 'konva/lib/types'
import { AnnoIcon, DeleteIcon, PaletteIcon } from '../../const/icon'
import { defaultOptions } from '../../const/default_options'
import { Divider, Form, Slider } from 'antd'
import Konva from 'konva'
import { isSameColor } from '../../utils/utils'
import { useTranslation } from 'react-i18next'
import { PAINTER_WRAPPER_PREFIX } from '../../painter/const'

interface CustomAnnotationMenuProps {
    onOpenComment: (annotation: IAnnotationStore) => void
    onChangeStyle: (annotation: IAnnotationStore, styles: IAnnotationStyle) => void
    onDelete: (annotation: IAnnotationStore) => void
}

export interface CustomAnnotationMenuRef {
    open(annotation: IAnnotationStore, selectorRect: IRect): void
    close(): void
}

/**
 * 根据 Konva 序列化字符串获取对应的 Konva 形状对象
 * @param {string} konvaString - Konva 节点的序列化字符串，通常包含完整的 Konva 节点信息
 * @returns {Konva.Node} 返回序列化字符串中第一个子节点，通常是具体的形状对象
 */
function getKonvaShapeForString(konvaString: string) {
    const ghostGroup = Konva.Node.create(konvaString) // 根据序列化字符串创建 Konva.Group 对象
    return ghostGroup.children[0] // 返回 Group 中的第一个子节点（形状对象）
}

/**
 * @description CustomAnnotationMenu
 */
/**
 * 自定义注释菜单组件
 * 使用forwardRef创建一个可被父组件引用的组件，用于显示注释相关的操作菜单
 */
const CustomAnnotationMenu = forwardRef<CustomAnnotationMenuRef, CustomAnnotationMenuProps>(function CustomAnnotationMenu(props, ref) {
    // 控制菜单显示状态
    const [show, setShow] = useState(false)
    // 当前选中的注释对象
    const [currentAnnotation, setCurrentAnnotation] = useState<IAnnotationStore | null>(null)

    // 当前注释颜色
    const [currentColor, setCurrentColor] = useState<string | null>(defaultOptions.setting.COLOR)

    // 注释线条宽度
    const [strokeWidth, setStrokeWidth] = useState<number | null>(defaultOptions.setting.STROKE_WIDTH)

    // 注释透明度
    const [opacity, seOpacity] = useState<number | null>(defaultOptions.setting.OPACITY)

    // 控制样式编辑面板的显示
    const [showStyle, setShowStyle] = useState(false)

    // 容器元素的引用
    const containerRef = useRef<HTMLDivElement | null>(null)

    // 国际化翻译钩子
    const { t } = useTranslation()


    // 使用useImperativeHandle暴露给父组件的方法
    useImperativeHandle(ref, () => ({
        open,
        close
    }))

    /**
     * 打开菜单
     * @param annotation 当前注释对象
     * @param selectorRect 选择器位置信息
     */
    const open = (annotation: IAnnotationStore, selectorRect: IRect) => {
        console.log('open----打开菜单111------------->', annotation,selectorRect)
        setCurrentAnnotation(annotation)
        setShow(true)
        // 获取当前注释的Konva形状对象
        const currentShape = getKonvaShapeForString(annotation.konvaString)
        setCurrentColor(currentShape.stroke())
        setStrokeWidth(currentShape.strokeWidth())
        seOpacity(currentShape.opacity() * 100)
        requestAnimationFrame(() => {
            const menuEl = containerRef.current
            if (!menuEl) return

            // 获取包装器ID
            const wrapperId = `${PAINTER_WRAPPER_PREFIX}_page_${annotation.pageNumber}`
            // 获取Konva容器元素
            const konvaContainer = document.querySelector(`#${wrapperId} .konvajs-content`) as HTMLElement
            const containerRect = konvaContainer?.getBoundingClientRect?.()

            // 设置缩放比例
            const scaleX = 1
            const scaleY = 1

            // 计算实际位置
            const realX = selectorRect.x * scaleX + containerRect.left
            const realY = selectorRect.y * scaleY + containerRect.top

            // 创建虚拟元素用于位置计算
            const virtualEl = {
                getBoundingClientRect() {
                    return {
                        x: realX,
                        y: realY,
                        width: selectorRect.width * scaleX,
                        height: selectorRect.height * scaleY,
                        left: realX,
                        top: realY,
                        right: realX + selectorRect.width * scaleX,
                        bottom: realY + selectorRect.height * scaleY,
                    }
                }
            }

            // 计算并设置菜单位置
            computePosition(virtualEl, menuEl, {
                placement: 'bottom',
                middleware: [flip()],
            }).then(({ x, y }) => {
                Object.assign(menuEl.style, {
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                })
            })
        })
    }

    /**
     * 关闭菜单
     */
    const close = () => {
        setShow(false)
        setCurrentAnnotation(null)
        setShowStyle(false)
    }

    // 检查当前注释是否支持样式编辑
    const isStyleSupported = currentAnnotation && annotationDefinitions.find(item => item.type === currentAnnotation.type)?.styleEditable

    /**
     * 处理注释样式变更
     * @param style 新的样式配置
     */
    const handleAnnotationStyleChange = (style: IAnnotationStyle) => {
        if (!currentAnnotation) return
        props.onChangeStyle(currentAnnotation, style)
    }
    // 渲染组件
    return (
        <div className={`CustomAnnotationMenu ${show ? 'show' : 'hide'}`} ref={containerRef}>

            {/* 渲染样式编辑面板 */}
            {
                showStyle && currentAnnotation && (
                    <div className="styleContainer">
                        {/* 渲染颜色选择器 */}
                        {
                            isStyleSupported.color && (
                                <div className="colorPalette">
                                    {defaultOptions.colors.map(color => (
                                        <div key={color} className={`cell ${isSameColor(color, currentColor) ? 'active' : ''}`} onMouseDown={() => {
                                            handleAnnotationStyleChange({ color })
                                            setCurrentColor(color)
                                        }}>
                                            <span style={{ backgroundColor: color }}></span>
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                        {/* 渲染线条宽度和透明度设置 */}
                        {
                            (isStyleSupported.opacity || isStyleSupported.strokeWidth) && (
                                <>
                                    <Divider size='small' />
                                    <div className='prototypeSetting'>
                                        <Form
                                            layout='vertical'
                                        >
                                            {/* 线条宽度设置 */}
                                            {
                                                isStyleSupported.strokeWidth && (<Form.Item label={`${t('normal.strokeWidth')} (${strokeWidth})`}>
                                                    <Slider
                                                        value={strokeWidth}
                                                        min={1}
                                                        max={20}
                                                        onChange={(value) => {
                                                            handleAnnotationStyleChange({ strokeWidth: value })
                                                            setStrokeWidth(value)
                                                        }}
                                                    />
                                                </Form.Item>)
                                            }
                                            {/* 透明度设置 */}
                                            {
                                                isStyleSupported.opacity && (<Form.Item label={`${t('normal.opacity')} (${opacity}%)`}>
                                                    <Slider
                                                        value={opacity}
                                                        min={0}
                                                        max={100}
                                                        onChange={(value) => {
                                                            handleAnnotationStyleChange({ opacity: value / 100 })
                                                            seOpacity(value)
                                                        }}
                                                    />
                                                </Form.Item>)
                                            }

                                        </Form>
                                    </div></>
                            )
                        }


                    </div>
                )
            }

            {/* 渲染操作按钮 */}
            {
                !showStyle && currentAnnotation && (
                    <ul className="buttons">
                        {/* 注释按钮 */}
                        <li onMouseDown={() => {
                            if (currentAnnotation) {
                                props.onOpenComment(currentAnnotation)
                                close()
                            }
                        }}>
                            <div className="icon">
                                <AnnoIcon />
                            </div>
                        </li>

                        {/* 样式编辑按钮 */}
                        {isStyleSupported && (
                            <li onMouseDown={() => {
                                if (currentAnnotation) {
                                    setShowStyle(true)
                                }
                            }}>
                                <div className="icon">
                                    <PaletteIcon />
                                </div>
                            </li>
                        )}

                        {/* 删除按钮 */}
                        <li onMouseDown={() => {
                            if (currentAnnotation) {
                                props.onDelete(currentAnnotation)
                                close()
                            }
                        }}>
                            <div className="icon">
                                <DeleteIcon />
                            </div>
                        </li>
                    </ul>
                )
            }


        </div>
    )
})

export { CustomAnnotationMenu }
