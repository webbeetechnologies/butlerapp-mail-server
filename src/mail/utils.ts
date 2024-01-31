export const stringifyForGraphQL = (jsonObject: Record<string, any>) => {
    try {
        const jsonString = JSON.stringify(normalizeObjStringValues(jsonObject));

        // Replace double quotes with escaped double quotes, except the ones that are already escaped
        return jsonString.replace(/(?<!\\)"/g, '\\"');
        // return jsonString.replace(/"/g, '\\"');
    } catch (error) {
        console.error("Error stringifying JSON:", error);
        return "";
    }
};

export const normalizeString = (value: any): string => {
    if (typeof value !== "string") return value;
    // Delete double quotes and remove line breaks
    return value.replace(/"/g, "").replace(/\n/g, "");
};

export const normalizeObjStringValues = (obj: Record<string, any>) => {
    return Object.keys(obj).reduce((acc, key) => {
        return { ...acc, [key]: normalizeString(obj[key]) };
    }, {});
};

export const generateUniqueString = (length: number) => {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    let result = "";
    for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
};
