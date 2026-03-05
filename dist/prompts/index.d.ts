interface PromptMessage {
    role: "user" | "assistant";
    content: {
        type: "text";
        text: string;
    };
}
interface PromptResult {
    messages: PromptMessage[];
}
/**
 * Get prompt definitions
 */
export declare function getPromptDefinitions(): ({
    name: string;
    description: string;
    arguments: {
        name: string;
        description: string;
        required: boolean;
    }[];
} | {
    name: string;
    description: string;
    arguments?: undefined;
})[];
/**
 * Handle prompt requests
 */
export declare function handlePrompt(name: string, args?: Record<string, string>): Promise<PromptResult>;
export {};
//# sourceMappingURL=index.d.ts.map