import React, { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { storage, db } from "@/firebase";
import ReactMarkdown from 'react-markdown';

type MemoCreateModalProps = {
    isOpen: boolean;
    onClose: () => void;
    selectedApt?: {
        id: string;
        apt_nm: string;
        jibun_address: string;
        lat?: number;
        lon?: number;
    } | null;
    editMemo?: {
        id: string;
        title: string;
        body: string;
        photoUrl?: string;
    } | null;
    onMemoUpdated?: () => void;
};

type MemoFormData = {
    title: string;
    body: string;
    photo: File | null;
};

const MemoCreateModal: React.FC<MemoCreateModalProps> = ({ 
    isOpen, 
    onClose, 
    selectedApt,
    editMemo,
    onMemoUpdated
}) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState<MemoFormData>({
        title: '',
        body: '',
        photo: null
    });
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
    const isEditMode = !!editMemo;

    // 편집 모드일 때 초기값 설정
    React.useEffect(() => {
        if (isEditMode && editMemo) {
            setFormData({
                title: editMemo.title,
                body: editMemo.body,
                photo: null
            });
            setPhotoPreview(editMemo.photoUrl || null);
        } else {
            setFormData({
                title: '',
                body: '',
                photo: null
            });
            setPhotoPreview(null);
        }
    }, [isEditMode, editMemo]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // 파일 크기 체크 (5MB 제한)
            if (file.size > 5 * 1024 * 1024) {
                setError('사진 파일 크기는 5MB 이하여야 합니다.');
                return;
            }

            // 파일 타입 체크
            if (!file.type.startsWith('image/')) {
                setError('이미지 파일만 업로드 가능합니다.');
                return;
            }

            setFormData(prev => ({ ...prev, photo: file }));
            
            // 미리보기 생성
            const reader = new FileReader();
            reader.onload = (e) => {
                setPhotoPreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
            setError('');
        }
    };

    const uploadPhotoToStorage = async (photo: File, memoId: string): Promise<string> => {
        if (!user) throw new Error('사용자 인증이 필요합니다.');

        // Firebase Storage 경로: /users/{uid}/photos/{memoId}.jpg
        const photoRef = ref(storage, `users/${user.uid}/photos/${memoId}.jpg`);
        
        // 파일 업로드
        const snapshot = await uploadBytes(photoRef, photo);
        
        // 다운로드 URL 가져오기
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    };

    const saveMemoToFirestore = async (memoData: any, memoId: string) => {
        if (!user) throw new Error('사용자 인증이 필요합니다.');

        // Firestore 경로: users/{uid}/memos/{memoId}
        const memoRef = doc(db, 'users', user.uid, 'memos', memoId);
        
        await setDoc(memoRef, memoData);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) {
            setError('로그인이 필요합니다.');
            return;
        }

        // 제목, 내용, 사진이 모두 비어있으면 에러
        if (!formData.title.trim() && !formData.body.trim() && !formData.photo) {
            setError('제목, 내용, 사진 중 하나는 입력해야 합니다.');
            return;
        }

        setIsUploading(true);
        setError('');

        try {
            let photoUrl = photoPreview; // 기존 사진 URL 유지
            const memoId = isEditMode ? editMemo!.id : `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 새 사진이 업로드된 경우에만 Storage에 업로드
            if (formData.photo) {
                console.log('📸 사진 업로드 시작...');
                photoUrl = await uploadPhotoToStorage(formData.photo, memoId);
                console.log('✅ 사진 업로드 완료:', photoUrl);
            }

            // 제목이 없으면 현재 시간으로 자동 생성
            const finalTitle = formData.title.trim() || new Date().toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Firestore에 저장할 데이터 준비 (undefined 값 제거)
            const memoData: any = {
                title: finalTitle,
                body: formData.body,
                updatedAt: new Date()
            };

            // 새로 생성하는 경우에만 createdAt 추가
            if (!isEditMode) {
                memoData.createdAt = new Date();
                // 값이 있을 때만 필드 추가
                if (selectedApt?.id) memoData.aptId = selectedApt.id.toString();
                if (selectedApt?.apt_nm) memoData.aptName = selectedApt.apt_nm;
                if (selectedApt?.jibun_address) memoData.aptAddress = selectedApt.jibun_address;
                if (selectedApt?.lat) memoData.lat = selectedApt.lat;
                if (selectedApt?.lon) memoData.lon = selectedApt.lon;
            }

            if (photoUrl) memoData.photoUrl = photoUrl;

            // Firestore에 메모 저장/수정
            console.log(isEditMode ? '📝 메모 수정 시작...' : '📝 메모 저장 시작...');
            await saveMemoToFirestore(memoData, memoId);
            console.log(isEditMode ? '✅ 메모 수정 완료' : '✅ 메모 저장 완료');

            // 성공 시 폼 초기화 및 모달 닫기
            setFormData({ title: '', body: '', photo: null });
            setPhotoPreview(null);
            onClose();
            
            // 편집 모드였다면 목록 새로고침
            if (isEditMode && onMemoUpdated) {
                onMemoUpdated();
            }
            
            alert(isEditMode ? '임장 메모가 성공적으로 수정되었습니다!' : '임장 메모가 성공적으로 저장되었습니다!');

        } catch (error: any) {
            console.error('❌ 메모 저장 오류:', error);
            setError(`저장 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isEditMode ? '📝 임장 메모 수정' : '📝 임장 메모 작성'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={isUploading}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 선택된 아파트 정보 */}
                {selectedApt && (
                    <div className="px-6 py-4 bg-blue-50 border-b">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm text-blue-700">선택된 아파트</span>
                        </div>
                        <div className="mt-1">
                            <div className="font-medium text-gray-800">{selectedApt.apt_nm}</div>
                            <div className="text-sm text-gray-600">{selectedApt.jibun_address}</div>
                        </div>
                    </div>
                )}

                {/* 폼 */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 제목 */}
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                            메모 제목 (선택사항)
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            placeholder="비워두면 현재 시간으로 자동 생성됩니다"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={isUploading}
                        />
                    </div>

                    {/* 메모 본문 */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="body" className="block text-sm font-medium text-gray-700">
                                메모 내용 (선택사항) - 마크다운 지원
                            </label>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('edit')}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                        previewMode === 'edit'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    편집
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('preview')}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                        previewMode === 'preview'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                    disabled={!formData.body.trim()}
                                >
                                    미리보기
                                </button>
                            </div>
                        </div>
                        
                        {previewMode === 'edit' ? (
                            <textarea
                                id="body"
                                name="body"
                                value={formData.body}
                                onChange={handleInputChange}
                                rows={6}
                                placeholder="현장에서 느낀 점, 주변 환경, 교통 상황, 향후 전망 등을 자유롭게 작성해주세요...

마크다운 문법을 사용할 수 있습니다:
**굵게**, *기울임*, # 제목, - 목록, [링크](URL) 등"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                                disabled={isUploading}
                            />
                        ) : (
                            <div className="w-full min-h-[144px] px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                                {formData.body.trim() ? (
                                    <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-800 prose-em:text-gray-700 prose-code:text-gray-800 prose-pre:text-gray-800 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700">
                                        <ReactMarkdown>
                                            {formData.body}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="text-gray-500 italic">내용을 입력하면 여기에 미리보기가 표시됩니다.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 사진 업로드 */}
                    <div>
                        <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-2">
                            사진 첨부 (선택사항)
                        </label>
                        
                        {/* 사진 업로드 버튼 */}
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                id="photo"
                                name="photo"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                className="hidden"
                                disabled={isUploading}
                            />
                            <label
                                htmlFor="photo"
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                사진 선택
                            </label>
                            {formData.photo && (
                                <span className="text-sm text-gray-600">
                                    {formData.photo.name} ({(formData.photo.size / 1024 / 1024).toFixed(1)}MB)
                                </span>
                            )}
                        </div>

                        {/* 사진 미리보기 */}
                        {photoPreview && (
                            <div className="mt-4">
                                <img
                                    src={photoPreview}
                                    alt="사진 미리보기"
                                    className="max-w-full h-48 object-cover rounded-md border"
                                />
                            </div>
                        )}
                    </div>

                    {/* 에러 메시지 */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3">
                            <div className="flex">
                                <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-red-600">{error}</span>
                            </div>
                        </div>
                    )}

                    {/* 제출 버튼 */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isUploading}
                            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading || (!formData.title.trim() && !formData.body.trim() && !formData.photo)}
                            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                        >
                            {isUploading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    저장 중...
                                </>
                            ) : (
                                isEditMode ? '메모 수정' : '메모 저장'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MemoCreateModal;