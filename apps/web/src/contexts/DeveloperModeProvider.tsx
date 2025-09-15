import React, { createContext, useContext, useState } from "react";

interface DeveloperModeContextType {
    isDeveloperMode: boolean;
    toggleDeveloperMode: () => void;
    setDeveloperMode: (enabled: boolean) => void;
}

// Context 생성
const DeveloperModeContext = createContext<DeveloperModeContextType | undefined>(undefined);

export const DeveloperModeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [isDeveloperMode, setIsDeveloperMode] = useState(false);

    const toggleDeveloperMode = () => {
        setIsDeveloperMode(prev => {
            const newState = !prev;
            console.log(`🔧 개발자 모드 ${newState ? '활성화' : '비활성화'}`);
            return newState;
        });
    };

    const setDeveloperMode = (enabled: boolean) => {
        setIsDeveloperMode(enabled);
        console.log(`🔧 개발자 모드 ${enabled ? '활성화' : '비활성화'}`);
    };

    const value = {
        isDeveloperMode,
        toggleDeveloperMode,
        setDeveloperMode
    };

    return (
        <DeveloperModeContext.Provider value={value}>
            {children}
        </DeveloperModeContext.Provider>
    );
};

// Hook for consuming the context
export const useDeveloperMode = (): DeveloperModeContextType => {
    const context = useContext(DeveloperModeContext);
    if (context === undefined) {
        throw new Error('useDeveloperMode must be used within a DeveloperModeProvider');
    }
    return context;
};