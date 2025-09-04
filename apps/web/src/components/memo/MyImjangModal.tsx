import React, { useState, useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "@/firebase";

type Memo = {
    id: string;
    title: string;
    body: string;
    aptId?: string;
    aptName?: string;
    aptAddress?: string;
    photoUrl?: string;
    createdAt: Date;
    updatedAt: Date;
};

type MyImjangModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onEditMemo?: (memo: Memo) => void;
    onMemoDeleted?: () => void;
};

const MyImjangModal: React.FC<MyImjangModalProps> = ({ isOpen, onClose, onEditMemo, onMemoDeleted }) => {
    const { user } = useAuth();
    const [memos, setMemos] = useState<Memo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            loadMemos();
        }
    }, [isOpen, user]);

    const loadMemos = async () => {
        if (!user) return;

        setLoading(true);
        setError('');

        try {
            const memosRef = collection(db, 'users', user.uid, 'memos');
            const q = query(memosRef, orderBy('updatedAt', 'desc'));
            const snapshot = await getDocs(q);

            const memosData: Memo[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                updatedAt: doc.data().updatedAt?.toDate() || new Date(),
            })) as Memo[];

            setMemos(memosData);
            console.log('📝 메모 목록 로드 완료:', memosData.length, '개');
        } catch (error: any) {
            console.error('❌ 메모 로드 오류:', error);
            setError('메모를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const deleteMemo = async (memoId: string) => {
        if (!user) return;
        
        if (!confirm('정말로 이 메모를 삭제하시겠어요?')) return;

        try {
            const memoRef = doc(db, 'users', user.uid, 'memos', memoId);
            await deleteDoc(memoRef);
            
            setMemos(prev => prev.filter(memo => memo.id !== memoId));
            console.log('🗑️ 메모 삭제 완료:', memoId);
            
            // 지도의 즐겨찾기 마커 새로고침
            onMemoDeleted?.();
        } catch (error) {
            console.error('❌ 메모 삭제 오류:', error);
            setError('메모 삭제 중 오류가 발생했습니다.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">
                        📝 내 임장 메모
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 콘텐츠 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ml-2 text-gray-600">메모를 불러오는 중...</span>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4">
                            <div className="flex">
                                <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-red-600">{error}</span>
                            </div>
                        </div>
                    ) : memos.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">메모가 없습니다</h3>
                            <p className="text-gray-600">아직 작성된 임장 메모가 없습니다.<br />아파트를 선택하고 임장 메모를 작성해보세요!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {memos.map((memo) => (
                                <div key={memo.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-start gap-4">
                                                {memo.photoUrl && (
                                                    <img 
                                                        src={memo.photoUrl} 
                                                        alt="메모 사진"
                                                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                                                        {memo.title}
                                                    </h3>
                                                    {memo.aptName && (
                                                        <div className="flex items-center gap-1 mb-2">
                                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                            </svg>
                                                            <span className="text-sm text-blue-600 font-medium">{memo.aptName}</span>
                                                        </div>
                                                    )}
                                                    {memo.body && (
                                                        <p className="text-gray-600 text-sm line-clamp-3 mb-2">
                                                            {memo.body}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        <span>작성: {memo.createdAt.toLocaleString('ko-KR')}</span>
                                                        <span>수정: {memo.updatedAt.toLocaleString('ko-KR')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    if (onEditMemo) {
                                                        onEditMemo(memo);
                                                        onClose();
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="메모 수정"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => deleteMemo(memo.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="메모 삭제"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="border-t p-6">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                            총 {memos.length}개의 메모
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyImjangModal;