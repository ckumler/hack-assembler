let inputTa = document.getElementById("input-ta");
let outputTa = document.getElementById("output-ta");
let assembleBtn = document.getElementById("assemble-btn");

let variableNumber = 16;
const symbolMap = new Map([
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

assembleBtn.addEventListener("click", () => {
    let inputData = inputTa.value;
    let parsedData = parse(inputData);
    outputTa.value = parsedData;
});

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
    //console.table(lineData);
    let output = "";

    //pass 1
    for (i = 0; i < lineDataDirty.length; i++) {
        if (lineDataDirty[i].slice(0, 2) == "//" || lineDataDirty[i] == "") {
            //comment or empty line
            /* console.log(
                `COMMENT/EMPTY on line ${i}\lineDataDirty[i] = ${lineDataDirty[i]}`
            ); */
        } else if (lineDataDirty[i].slice(0, 1) == "(") {
            //label
            const symbol = lineDataDirty[i].slice(1, -1);
            symbolMap.set(symbol, lineData.length);
            console.log(
                `LABEL\nsymbol = ${symbol}\nlineNumberSaved = ${symbolMap.get(
                    symbol
                )}`
            );
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
            /* console.log(
                `A INSTRUCTION on line ${i}\nlineData[i] = ${lineData[i]}\n bin = ${bin}`
            ); */
            output += `${bin}\n`;
        } else {
            //c instruction
            let bin = convertCInstruction(lineData[i]);
            /* console.log(
                `C INSTRUCTION on line ${i}\nlineData[i] = ${lineData[i]}\n bin = ${bin}`
            ); */
            output += `${bin}\n`;
        }
    }
    return output;
}

function convertAInstruction(str) {
    let symbol = str.slice(1);
    let num;

    if (symbolMap.has(symbol)) {
        num = symbolMap.get(symbol);
        console.log(`HAS SYMBOL!\nsymbol = ${symbol}\naddress = ${num}`);
    } else {
        console.log(
            `check type of symbol\ntypeof ${symbol} == ${typeof parseInt(
                symbol
            )}`
        );
        if (isNaN(parseInt(symbol))) {
            symbolMap.set(symbol, variableNumber);
            num = symbolMap.get(symbol);
            variableNumber++;
            console.log(
                `NO HAS SYMBOL : SAVING!\nsymbol = ${symbol}\naddress = ${num}`
            );
        } else {
            num = parseInt(symbol);
            console.log(
                `NO HAS SYMBOL BUT IS NUMBER!\naddress = ${num}\nparseInt == ${parseInt(
                    symbol
                )}`
            );
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
        console.log("IT'S CDJ!");
        c = findComp(cdjArray[0]);
        d = findDest(cdjArray[1]);
        j = findJump(cdjArray[2]);
    } else if (str.includes("=")) {
        //includes cd
        console.log("IT'S CD!");
        c = findComp(cdjArray[0]);
        d = findDest(cdjArray[1]);
    } else if (str.includes(";")) {
        //includes cj
        console.log("IT'S CJ!");
        c = findComp(cdjArray[0]);
        j = findJump(cdjArray[2]);
    } else {
        //only c
        console.log("IT'S C!");
        c = findComp(cdjArray[0]);
    }

    binary = `111${c}${d}${j}`;
    return binary;
}

function splitCDJ(str) {
    let parts = str.split(";");
    console.log(`str = ${str}\nparts = ${parts}`);
    let compAndDest;
    let c, d, j;

    // Check if there's a jump part
    if (parts.length === 2) {
        j = parts[1];
        compAndDest = parts[0].split("=");
        console.log(`j = ${j}\ncompAndDest = ${compAndDest}`);
    } else {
        compAndDest = parts[0].split("=");
        console.log(`compAndDest = ${compAndDest}`);
    }
    if (compAndDest.length === 2) {
        d = compAndDest[0];
        c = compAndDest[1];
        console.log(`d = ${compAndDest[0]}\nc = ${compAndDest[1]}`);
    } else {
        c = compAndDest[0];
        console.log(`c = ${compAndDest[0]}`);
    }

    console.log(`str = ${str}\ncdj = ${c},${d},${j}`);

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
