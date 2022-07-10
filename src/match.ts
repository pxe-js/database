/**
 * Check whether a match b
 * @param a 
 * @param b 
 * @returns 
 */
function match(a: any, b: any) {
    if (a == b)
        return true;

    else if (typeof a === "object") {
        for (const key in a) 
            if (!match(a[key], b[key]))
                return false;
        
        return true;
    } else
        return false;
}

export = match;