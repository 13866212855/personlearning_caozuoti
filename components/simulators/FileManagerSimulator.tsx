'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ClipboardPaste,
  Copy,
  Edit3,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Link2,
  Scissors,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { FileState, VirtualFileItem } from '@/lib/types';

interface FileManagerSimulatorProps {
  value: FileState;
  onChange: (next: FileState) => void;
  readOnly?: boolean;
}

export default function FileManagerSimulator({
  value,
  onChange,
  readOnly = false,
}: FileManagerSimulatorProps) {
  const items = value.items || [];
  const [currentDir, setCurrentDir] = useState<string>('D:');
  const [selectedId, setSelectedId] = useState<string>('');
  const [clipboard, setClipboard] = useState<{
    mode: 'copy' | 'cut';
    item: VirtualFileItem;
  } | null>(null);
  const [showHidden, setShowHidden] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const [modalMode, setModalMode] = useState<
    null | 'newFolder' | 'newFile' | 'rename' | 'properties' | 'preview'
  >(null);
  const [nameInput, setNameInput] = useState('');
  const [fileContentInput, setFileContentInput] = useState('');
  const [propReadOnly, setPropReadOnly] = useState(false);
  const [propHidden, setPropHidden] = useState(false);

  const selectedItem = items.find((i) => i.id === selectedId) || null;
  const folders = items.filter((i) => i.type === 'folder');
  const visibleChildren = items.filter(
    (i) => i.parentPath === currentDir && (showHidden || !i.hidden)
  );

  const goUp = () => {
    if (currentDir === 'D:' || !currentDir.includes('/')) return;
    const parent = currentDir.slice(0, currentDir.lastIndexOf('/'));
    setCurrentDir(parent || 'D:');
    setSelectedId('');
  };

  const updatePathsRecursively = (
    all: VirtualFileItem[],
    target: VirtualFileItem,
    newParent: string,
    newName: string
  ): VirtualFileItem[] => {
    const oldPrefix = target.path;
    const newPath = `${newParent}/${newName}`;
    return all.map((item) => {
      if (item.id === target.id) {
        return { ...item, name: newName, parentPath: newParent, path: newPath };
      }
      if (item.path.startsWith(oldPrefix + '/')) {
        const suffix = item.path.slice(oldPrefix.length);
        const updatedPath = newPath + suffix;
        const updatedParent = updatedPath.slice(0, updatedPath.lastIndexOf('/'));
        return { ...item, path: updatedPath, parentPath: updatedParent };
      }
      return item;
    });
  };

  const handleCreateFolder = () => {
    if (readOnly || !nameInput.trim()) return;
    const cleanName = nameInput.trim();
    const newPath = `${currentDir}/${cleanName}`;
    if (items.some((i) => i.path === newPath)) {
      setStatusMsg('当前目录下已存在同名项目');
      return;
    }
    const created: VirtualFileItem = {
      id: `fld-${Date.now()}`,
      path: newPath,
      name: cleanName,
      type: 'folder',
      parentPath: currentDir,
    };
    onChange({ items: [...items, created] });
    setModalMode(null);
    setNameInput('');
    setStatusMsg(`已新建文件夹“${cleanName}”`);
  };

  const handleCreateFile = () => {
    if (readOnly || !nameInput.trim()) return;
    const cleanName = nameInput.trim();
    const newPath = `${currentDir}/${cleanName}`;
    if (items.some((i) => i.path === newPath)) {
      setStatusMsg('当前目录下已存在同名项目');
      return;
    }
    const created: VirtualFileItem = {
      id: `fil-${Date.now()}`,
      path: newPath,
      name: cleanName,
      type: 'file',
      parentPath: currentDir,
      content: fileContentInput,
      size: Math.max(1, fileContentInput.length),
      readOnly: false,
      hidden: false,
    };
    onChange({ items: [...items, created] });
    setModalMode(null);
    setNameInput('');
    setFileContentInput('');
    setStatusMsg(`已新建文件“${cleanName}”`);
  };

  const handleRename = () => {
    if (readOnly || !selectedItem || !nameInput.trim()) return;
    const cleanName = nameInput.trim();
    const updated = updatePathsRecursively(
      items,
      selectedItem,
      selectedItem.parentPath,
      cleanName
    );
    onChange({ items: updated });
    setModalMode(null);
    setStatusMsg(`已重命名为“${cleanName}”`);
  };

  const handleDelete = () => {
    if (readOnly || !selectedItem || selectedItem.path === 'D:') return;
    const prefix = selectedItem.path + '/';
    const filtered = items.filter(
      (i) => i.id !== selectedItem.id && !i.path.startsWith(prefix)
    );
    onChange({ items: filtered });
    setSelectedId('');
    setStatusMsg(`已删除“${selectedItem.name}”`);
  };

  const handlePaste = () => {
    if (readOnly || !clipboard) return;
    const src = clipboard.item;
    if (currentDir === src.parentPath && clipboard.mode === 'cut') return;
    if (
      src.type === 'folder' &&
      (currentDir === src.path || currentDir.startsWith(src.path + '/'))
    ) {
      setStatusMsg('不能将文件夹移动到自身子目录下');
      return;
    }

    if (clipboard.mode === 'cut') {
      const updated = updatePathsRecursively(items, src, currentDir, src.name);
      onChange({ items: updated });
      setClipboard(null);
      setStatusMsg(`已移动“${src.name}”到 ${currentDir}`);
    } else {
      const destPath = `${currentDir}/${src.name}`;
      if (items.some((i) => i.path === destPath)) {
        setStatusMsg('目标目录已有同名文件');
        return;
      }
      const copyItem: VirtualFileItem = {
        ...src,
        id: `cpy-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        parentPath: currentDir,
        path: destPath,
      };
      onChange({ items: [...items, copyItem] });
      setStatusMsg(`已复制“${src.name}”到 ${currentDir}`);
    }
  };

  const handleCreateShortcut = () => {
    if (readOnly || !selectedItem || selectedItem.path === 'D:') return;
    const baseName = selectedItem.name.replace(/\.[^.]+$/, '');
    const lnkName = `${baseName}.lnk`;
    const lnkPath = `${currentDir}/${lnkName}`;
    const shortcut: VirtualFileItem = {
      id: `lnk-${Date.now()}`,
      path: lnkPath,
      name: lnkName,
      type: 'shortcut',
      parentPath: currentDir,
      targetPath: selectedItem.path,
      size: 1,
    };
    onChange({ items: [...items, shortcut] });
    setStatusMsg(`已创建快捷方式“${lnkName}”`);
  };

  const openProperties = () => {
    if (!selectedItem) return;
    setPropReadOnly(Boolean(selectedItem.readOnly));
    setPropHidden(Boolean(selectedItem.hidden));
    setModalMode('properties');
  };

  const saveProperties = () => {
    if (readOnly || !selectedItem) return;
    onChange({
      items: items.map((i) =>
        i.id === selectedItem.id
          ? { ...i, readOnly: propReadOnly, hidden: propHidden }
          : i
      ),
    });
    setModalMode(null);
    setStatusMsg(`已更新“${selectedItem.name}”属性`);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Action Ribbon */}
      {!readOnly && (
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setNameInput('');
              setModalMode('newFolder');
            }}
            className="h-8 px-2.5 rounded bg-white border border-slate-200 hover:border-sky-400 text-slate-700 flex items-center gap-1.5 font-medium whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5 text-sky-600" />
            <span>新建文件夹</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNameInput('');
              setFileContentInput('');
              setModalMode('newFile');
            }}
            className="h-8 px-2.5 rounded bg-white border border-slate-200 hover:border-sky-400 text-slate-700 flex items-center gap-1.5 font-medium whitespace-nowrap"
          >
            <FilePlus className="w-3.5 h-3.5 text-teal-600" />
            <span>新建文件</span>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => {
              if (!selectedItem) return;
              setNameInput(selectedItem.name);
              setModalMode('rename');
            }}
            className="h-8 px-2.5 rounded hover:bg-slate-200/70 disabled:opacity-40 text-slate-700 flex items-center gap-1 whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>重命名</span>
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => {
              if (!selectedItem) return;
              setClipboard({ mode: 'copy', item: selectedItem });
              setStatusMsg(`已复制“${selectedItem.name}”`);
            }}
            className="h-8 px-2.5 rounded hover:bg-slate-200/70 disabled:opacity-40 text-slate-700 flex items-center gap-1 whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>复制</span>
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => {
              if (!selectedItem) return;
              setClipboard({ mode: 'cut', item: selectedItem });
              setStatusMsg(`已剪切“${selectedItem.name}”`);
            }}
            className="h-8 px-2.5 rounded hover:bg-slate-200/70 disabled:opacity-40 text-slate-700 flex items-center gap-1 whitespace-nowrap"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>剪切</span>
          </button>
          <button
            type="button"
            disabled={!clipboard}
            onClick={handlePaste}
            className="h-8 px-2.5 rounded hover:bg-slate-200/70 disabled:opacity-40 text-slate-700 flex items-center gap-1 whitespace-nowrap"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>粘贴</span>
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={handleCreateShortcut}
            className="h-8 px-2.5 rounded hover:bg-slate-200/70 disabled:opacity-40 text-slate-700 flex items-center gap-1 whitespace-nowrap"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>创建快捷方式</span>
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={openProperties}
            className="h-8 px-2.5 rounded hover:bg-slate-200/70 disabled:opacity-40 text-slate-700 flex items-center gap-1 whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>属性</span>
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={handleDelete}
            className="h-8 px-2.5 rounded hover:bg-red-50 disabled:opacity-40 text-red-600 flex items-center gap-1 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除</span>
          </button>
        </div>
      )}

      {/* Address Bar */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={goUp}
            disabled={currentDir === 'D:'}
            className="h-7 px-2 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>上级目录</span>
          </button>
          <div className="px-2.5 py-1 bg-slate-100 rounded font-mono text-slate-800 truncate">
            {currentDir}/
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-slate-600 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          <span>显示隐藏项目</span>
        </label>
      </div>

      {/* Body Split: Folder Tree + File Grid */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Tree */}
        <div className="w-48 border-r border-slate-200 bg-slate-50/70 p-2.5 overflow-auto shrink-0 space-y-1">
          <div className="text-xs font-semibold text-slate-500 px-2 pb-1">
            目录导航
          </div>
          {folders.map((fld) => {
            const depth = fld.path.split('/').length - 1;
            const active = currentDir === fld.path;
            return (
              <button
                key={fld.id}
                type="button"
                onClick={() => {
                  setCurrentDir(fld.path);
                  setSelectedId('');
                }}
                style={{ paddingLeft: `${8 + depth * 12}px` }}
                className={`w-full text-left py-1.5 pr-2 rounded-md text-xs flex items-center gap-1.5 truncate transition-colors ${
                  active
                    ? 'bg-sky-100 text-sky-800 font-semibold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{fld.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right File List */}
        <div className="flex-1 overflow-auto p-3">
          {visibleChildren.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400">
              此文件夹为空
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 px-2 font-medium">名称</th>
                  <th className="py-2 px-2 font-medium">类型</th>
                  <th className="py-2 px-2 font-medium">属性</th>
                  <th className="py-2 px-2 font-medium text-right">大小</th>
                </tr>
              </thead>
              <tbody>
                {visibleChildren.map((item) => {
                  const selected = selectedId === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      onDoubleClick={() => {
                        if (item.type === 'folder') {
                          setCurrentDir(item.path);
                          setSelectedId('');
                        } else if (item.type === 'file') {
                          setFileContentInput(item.content || '');
                          setModalMode('preview');
                        }
                      }}
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${
                        selected
                          ? 'bg-sky-50 text-sky-900'
                          : 'hover:bg-slate-50 text-slate-800'
                      } ${item.hidden ? 'opacity-65' : ''}`}
                    >
                      <td className="py-2.5 px-2 flex items-center gap-2">
                        {item.type === 'folder' ? (
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : item.type === 'shortcut' ? (
                          <Link2 className="w-4 h-4 text-sky-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span className="font-medium">{item.name}</span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-500">
                        {item.type === 'folder'
                          ? '文件夹'
                          : item.type === 'shortcut'
                            ? `快捷方式 (→ ${item.targetPath})`
                            : '文件'}
                      </td>
                      <td className="py-2.5 px-2 text-slate-500">
                        {[
                          item.readOnly ? '只读' : '',
                          item.hidden ? '隐藏' : '',
                        ]
                          .filter(Boolean)
                          .join(' / ') || '常规'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-500 tabular-nums">
                        {item.type === 'folder' ? '-' : `${item.size || 1} KB`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom Hint Bar */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500 flex items-center justify-between">
        <span>
          共 {visibleChildren.length} 个项目（双击文件夹进入，单击选中后可重命名/剪切/属性）
        </span>
        {statusMsg && <span className="text-sky-700 font-medium">{statusMsg}</span>}
      </div>

      {/* Modals */}
      {(modalMode === 'newFolder' ||
        modalMode === 'newFile' ||
        modalMode === 'rename') && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {modalMode === 'newFolder'
                ? '新建文件夹'
                : modalMode === 'newFile'
                  ? '新建文件'
                  : '重命名'}
            </h3>
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="请输入名称（含扩展名）"
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm"
            />
            {modalMode === 'newFile' && (
              <textarea
                rows={4}
                value={fileContentInput}
                onChange={(e) => setFileContentInput(e.target.value)}
                placeholder="文件内容（可选）"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modalMode === 'newFolder') handleCreateFolder();
                  else if (modalMode === 'newFile') handleCreateFile();
                  else handleRename();
                }}
                className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode === 'properties' && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-sm space-y-4 text-sm">
            <h3 className="text-base font-semibold text-slate-900">
              属性 - {selectedItem.name}
            </h3>
            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
              <div>完整路径：{selectedItem.path}</div>
              <div>项目类型：{selectedItem.type}</div>
              {selectedItem.targetPath && (
                <div>目标位置：{selectedItem.targetPath}</div>
              )}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={propReadOnly}
                  onChange={(e) => setPropReadOnly(e.target.checked)}
                />
                <span>只读 (Read-only)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={propHidden}
                  onChange={(e) => setPropHidden(e.target.checked)}
                />
                <span>隐藏 (Hidden)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveProperties}
                className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
              >
                保存属性
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode === 'preview' && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 w-full max-w-md space-y-3">
            <h3 className="text-base font-semibold text-slate-900">
              文件内容 - {selectedItem.name}
            </h3>
            <textarea
              rows={6}
              readOnly={readOnly || selectedItem.readOnly}
              value={fileContentInput}
              onChange={(e) => setFileContentInput(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
            />
            {selectedItem.readOnly && (
              <p className="text-xs text-amber-700">该文件为“只读”属性，不可修改内容。</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                关闭
              </button>
              {!readOnly && !selectedItem.readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      items: items.map((i) =>
                        i.id === selectedItem.id
                          ? { ...i, content: fileContentInput }
                          : i
                      ),
                    });
                    setModalMode(null);
                  }}
                  className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium"
                >
                  保存内容
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
