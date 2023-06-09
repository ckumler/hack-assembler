let inputTa = document.getElementById("input-ta");
let outputTa = document.getElementById("output-ta");
let assembleBtn = document.getElementById("assemble-btn");
let loadBtn = document.getElementById("load-btn");
let fileInput = document.getElementById("file-input");
let saveBtn = document.getElementById("save-btn");

let loadedFileName = null;

assembleBtn.addEventListener("click", () => {
    buildSymbolMap();
    let inputData = inputTa.value;
    let parsedData = parse(inputData);
    outputTa.value = parsedData;
});
loadBtn.addEventListener("click", () => {
    fileInput.click();
});
fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];

    if (!file) return;

    outputTa.value = "";

    loadedFileName = file.name.replace(/\.[^/.]+$/, "");

    const reader = new FileReader();
    reader.onload = function (e) {
        inputTa.value = e.target.result;
    };
    reader.readAsText(file);
});
saveBtn.addEventListener("click", async () => {
    const text = outputTa.value;
    const suggestedName = loadedFileName
        ? `${loadedFileName}.hack`
        : "output.hack";

    if (window.showSaveFilePicker) {
        const opts = {
            suggestedName: suggestedName,
            types: [
                {
                    description: "Hack file",
                    accept: { "text/plain": [".hack"] },
                },
            ],
        };

        try {
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();
            return;
        } catch (err) {
            console.error(err.name, err.message);

            // If showSaveFilePicker fails due to user cancellation, don't fall through
            if (err.name === "AbortError") {
                return;
            }
        }
    }

    // Blob-based method
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

let variableNumber = 16;
let symbolMap = new Map([
    ["SP", 0],
    ["LCL", 1],
    ["ARG", 2],
    ["THIS", 3],
    ["THAT", 4],
    ["R0", 0],
    ["R1", 1],
    ["R2", 2],
    ["R3", 3],
    ["R4", 4],
    ["R5", 5],
    ["R6", 6],
    ["R7", 7],
    ["R8", 8],
    ["R9", 9],
    ["R10", 10],
    ["R11", 11],
    ["R12", 12],
    ["R13", 13],
    ["R14", 14],
    ["R15", 15],
    ["SCREEN", 16384],
    ["KBD", 24576],
]);
const compMap = new Map([
    ["0", "101010"],
    ["1", "111111"],
    ["-1", "111010"],
    ["D", "001100"],
    ["A", "110000"],
    ["!D", "001101"],
    ["!A", "110001"],
    ["-D", "001111"],
    ["-A", "110011"],
    ["D+1", "011111"],
    ["A+1", "110111"],
    ["D-1", "001110"],
    ["A-1", "110010"],
    ["D+A", "000010"],
    ["D-A", "010011"],
    ["A-D", "000111"],
    ["D&A", "000000"],
    ["D|A", "010101"],
]);
const compAMap = new Map([
    ["M", "110000"],
    ["!M", "110001"],
    ["-M", "110011"],
    ["M+1", "110111"],
    ["M-1", "110010"],
    ["D+M", "000010"],
    ["D-M", "010011"],
    ["M-D", "000111"],
    ["D&M", "000000"],
    ["D|M", "010101"],
]);
const destMap = new Map([
    ["M", "001"],
    ["D", "010"],
    ["MD", "011"],
    ["A", "100"],
    ["AM", "101"],
    ["AD", "110"],
    ["AMD", "111"],
]);
const jumpMap = new Map([
    ["JGT", "001"],
    ["JEQ", "010"],
    ["JGE", "011"],
    ["JLT", "100"],
    ["JNE", "101"],
    ["JLE", "110"],
    ["JMP", "111"],
]);

function parse(data) {
    let lineDataDirty = data
        .toUpperCase()
        .replace(/[^\S\n]/g, "")
        .split("\n")
        .map((line) => {
            let parts = line.split("//");
            return parts[0].trim();
        });
    let lineData = [];
    let output = "";

    //pass 1
    for (i = 0; i < lineDataDirty.length; i++) {
        if (lineDataDirty[i].slice(0, 2) == "//" || lineDataDirty[i] == "") {
            //comment or empty line
        } else if (lineDataDirty[i].slice(0, 1) == "(") {
            //label
            const symbol = lineDataDirty[i].slice(1, -1);
            symbolMap.set(symbol, lineData.length);
        } else {
            //instruction line
            lineData.push(lineDataDirty[i]);
        }
    }

    //pass 2
    for (i = 0; i < lineData.length; i++) {
        if (lineData[i].slice(0, 1) == "@") {
            //a instruction
            let bin = convertAInstruction(lineData[i]);
            output += `${bin}\n`;
        } else {
            //c instruction
            let bin = convertCInstruction(lineData[i]);
            output += `${bin}\n`;
        }
    }

    if (output.match(/[^10\n]/g)) {
        return "ERROR: ASM FILE IS CORRUPT!";
    }

    return output;
}

function convertAInstruction(str) {
    let symbol = str.slice(1);
    let num;

    if (symbolMap.has(symbol)) {
        num = symbolMap.get(symbol);
    } else {
        if (isNaN(parseInt(symbol))) {
            symbolMap.set(symbol, variableNumber);
            num = symbolMap.get(symbol);
            variableNumber++;
        } else {
            num = parseInt(symbol);
        }
    }

    if (num > 32767) {
        throw new Error(
            `@${num} is out of range. Pointer should be less than or equal to 32767`
        );
    }

    num = num & 0x7fff; // Ensure the number fits in 15 bits.

    // Convert to binary and pad with leading zeros to get 16 digits
    let binary = num.toString(2).padStart(16, "0");
    return binary;
}

function convertCInstruction(str) {
    let c = "0101010"; //a c1 c2 c3 c4 c5 c6
    let d = "000";
    let j = "000";

    let cdjArray = splitCDJ(str);

    if (str.includes("=") && str.includes(";")) {
        //includes cdj
        c = findComp(cdjArray[0]);
        d = findDest(cdjArray[1]);
        j = findJump(cdjArray[2]);
    } else if (str.includes("=")) {
        //includes cd
        c = findComp(cdjArray[0]);
        d = findDest(cdjArray[1]);
    } else if (str.includes(";")) {
        //includes cj
        c = findComp(cdjArray[0]);
        j = findJump(cdjArray[2]);
    } else {
        //only c
        c = findComp(cdjArray[0]);
    }

    binary = `111${c}${d}${j}`;
    return binary;
}

function splitCDJ(str) {
    let parts = str.split(";");
    let compAndDest;
    let c, d, j;

    // Check if there's a jump part
    if (parts.length === 2) {
        j = parts[1];
        compAndDest = parts[0].split("=");
    } else {
        compAndDest = parts[0].split("=");
    }
    if (compAndDest.length === 2) {
        d = compAndDest[0];
        c = compAndDest[1];
    } else {
        c = compAndDest[0];
    }

    return [c, d, j];
}

function findComp(str) {
    let comp = "";
    if (str.includes("M")) {
        comp = `1${compAMap.get(str)}`;
    } else {
        comp = `0${compMap.get(str)}`;
    }
    return comp;
}

function findDest(str) {
    let dest = `${destMap.get(str)}`;
    return dest;
}

function findJump(str) {
    let jump = `${jumpMap.get(str)}`;
    return jump;
}

function buildSymbolMap() {
    variableNumber = 16;
    symbolMap.clear();
    symbolMap = new Map([
        ["SP", 0],
        ["LCL", 1],
        ["ARG", 2],
        ["THIS", 3],
        ["THAT", 4],
        ["R0", 0],
        ["R1", 1],
        ["R2", 2],
        ["R3", 3],
        ["R4", 4],
        ["R5", 5],
        ["R6", 6],
        ["R7", 7],
        ["R8", 8],
        ["R9", 9],
        ["R10", 10],
        ["R11", 11],
        ["R12", 12],
        ["R13", 13],
        ["R14", 14],
        ["R15", 15],
        ["SCREEN", 16384],
        ["KBD", 24576],
    ]);
}
