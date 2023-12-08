export const stringifyForGraphQL = (jsonObject: Record<string, any>) => {
    try {
        const jsonString = JSON.stringify(normalizeObjStringValues(jsonObject));
        return jsonString.replace(/"/g, '\\"'); // Replace double quotes with escaped double quotes
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
