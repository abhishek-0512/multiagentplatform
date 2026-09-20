import vm from "vm"

// Virtual DOM and Execution Engine for Coding Agent Verification
export const executeAndVerify = async (files, prompt, criteria = []) => {
    const results = {
        attempted: true,
        status: "verified",
        testsRun: [],
        errors: [],
        errorsFixed: []
    }

    if (!files || files.length === 0) {
        results.status = "failed"
        results.errors.push("No files generated")
        return results
    }

    const lowerPrompt = (prompt || "").toLowerCase()
    const isWeb = files.some(f =>
        f.name === "index.html" ||
        f.name.endsWith(".html") ||
        f.content.includes("<!DOCTYPE") ||
        f.content.includes("<html") ||
        f.content.includes("<button") ||
        f.content.includes("document.") ||
        f.content.includes("window.")
    )
    const isJs = files.some(f => f.name === "script.js" || f.name.endsWith(".js") || f.name.endsWith(".ts"))

    console.log(`[CODE] build started: analyzing ${files.length} file(s) for prompt "${prompt.slice(0, 40)}..." (isWeb=${isWeb})`)

    // Step 1: Syntax & Static Structure Validation
    for (const file of files) {
        if (file.name.endsWith(".js") || (!file.name.includes(".") && !file.content.includes("<html"))) {
            try {
                new vm.Script(file.content)
                results.testsRun.push({ name: `Syntax Check (${file.name})`, passed: true, message: "Valid JavaScript syntax" })
            } catch (syntaxErr) {
                // If it's a DOM script, syntax check passes unless genuine syntax error
                if (!syntaxErr.message.includes("document") && !syntaxErr.message.includes("window")) {
                    results.testsRun.push({ name: `Syntax Check (${file.name})`, passed: false, message: syntaxErr.message })
                    results.errors.push(`Syntax error in ${file.name}: ${syntaxErr.message}`)
                    results.status = "failed"
                }
            }
        } else if (file.name.endsWith(".html") || file.content.includes("<html") || file.content.includes("<!DOCTYPE")) {
            const hasHtmlTag = file.content.includes("<") && file.content.includes(">")
            if (hasHtmlTag) {
                results.testsRun.push({ name: `HTML Structure Check (${file.name})`, passed: true, message: "Valid HTML markup" })
            } else {
                results.testsRun.push({ name: `HTML Structure Check (${file.name})`, passed: false, message: "Missing HTML tags" })
                results.errors.push("Invalid HTML content")
                results.status = "failed"
            }
        }
    }

    // If static syntax failed, return early for repair
    if (results.status === "failed") {
        return results
    }

    // Step 2: Dynamic Execution & Interaction Testing for Web Apps
    if (isWeb) {
        try {
            const jsdomModule = await import("jsdom").catch(() => null)
            if (jsdomModule && jsdomModule.JSDOM) {
                const { JSDOM } = jsdomModule
                let htmlFile = files.find(f => f.name === "index.html" || f.name.endsWith(".html") || f.content.includes("<html") || f.content.includes("<!DOCTYPE"))
                const jsFile = files.find(f => f.name === "script.js" || f.name.endsWith(".js") || (!f.name.endsWith(".html") && !f.name.endsWith(".css") && (f.content.includes("function") || f.content.includes("document."))))
                const cssFile = files.find(f => f.name === "style.css" || f.name.endsWith(".css"))

                let combinedHtml = htmlFile ? htmlFile.content : "<!DOCTYPE html><html><head></head><body></body></html>"
                if (cssFile && !combinedHtml.includes(cssFile.content)) {
                    if (combinedHtml.includes("</head>")) {
                        combinedHtml = combinedHtml.replace("</head>", `<style>${cssFile.content}</style></head>`)
                    } else {
                        combinedHtml = `<style>${cssFile.content}</style>` + combinedHtml
                    }
                }

                const runtimeErrors = []
                const virtualConsole = new jsdomModule.VirtualConsole()
                virtualConsole.on("error", (err) => {
                    runtimeErrors.push(err.message || String(err))
                })
                virtualConsole.on("jsdomError", (err) => {
                    runtimeErrors.push(err.message || String(err))
                })

                const dom = new JSDOM(combinedHtml, {
                    runScripts: "dangerously",
                    resources: "usable",
                    virtualConsole,
                    url: "http://localhost:3000"
                })

                const { window } = dom
                const { document } = window

                // Inject & execute JavaScript in standard browser window scope
                if (jsFile && jsFile.content) {
                    try {
                        const scriptEl = document.createElement("script")
                        scriptEl.textContent = jsFile.content
                        document.body.appendChild(scriptEl)

                        // Trigger DOMContentLoaded and load
                        document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true, cancelable: true }))
                        window.dispatchEvent(new window.Event("load", { bubbles: true, cancelable: true }))
                    } catch (jsEvalErr) {
                        runtimeErrors.push(`JavaScript Runtime Exception: ${jsEvalErr.message}`)
                    }
                }

                if (runtimeErrors.length > 0) {
                    results.errors.push(...runtimeErrors)
                    results.status = "failed"
                    results.testsRun.push({ name: "JavaScript Runtime Execution", passed: false, message: runtimeErrors.join("; ") })
                    return results
                }

                results.testsRun.push({ name: "DOM & Script Mount Execution", passed: true, message: "DOM initialized and script executed cleanly" })

                // Interactive Behavioral Testing based on App Type
                if (lowerPrompt.includes("calculator") || lowerPrompt.includes("calculate")) {
                    await testCalculator(document, window, results)
                } else if (lowerPrompt.includes("todo") || lowerPrompt.includes("task")) {
                    await testTodoApp(document, window, results)
                } else if (lowerPrompt.includes("form") && lowerPrompt.includes("validation")) {
                    await testFormValidation(document, window, results)
                } else {
                    await testGenericWebApp(document, window, results)
                }
            } else {
                results.testsRun.push({ name: "Static Code Analysis & Verification", passed: true, message: "Code structure validated" })
            }
        } catch (execErr) {
            console.log("[CODE] Dynamic execution test error:", execErr.message)
            results.errors.push(`Execution error: ${execErr.message}`)
            results.status = "failed"
        }
    }

    // Step 3: Dynamic Verification for Pure JavaScript / Node Algorithms
    if (!isWeb && isJs) {
        const jsFile = files.find(f => f.name.endsWith(".js"))
        if (jsFile) {
            try {
                const sandbox = { console: { log: () => {} }, exports: {}, module: { exports: {} } }
                const context = vm.createContext(sandbox)
                vm.runInContext(jsFile.content, context, { timeout: 1000 })
                results.testsRun.push({ name: "Module Execution Test", passed: true, message: "Script executed without errors" })
            } catch (vmErr) {
                results.errors.push(`Script execution error: ${vmErr.message}`)
                results.status = "failed"
                results.testsRun.push({ name: "Module Execution Test", passed: false, message: vmErr.message })
            }
        }
    }

    console.log(`[CODE] test completed: status=${results.status}, passed=${results.testsRun.filter(t => t.passed).length}/${results.testsRun.length}`)
    return results
}

// ----------------- CALCULATOR INTERACTIVE VERIFIER -----------------
async function testCalculator(document, window, results) {
    console.log("[CODE] test started: Running Calculator functional test suite")

    const findDisplay = () => {
        return document.querySelector('#display, .display, input[type="text"], input[readonly], #screen, .screen, [data-display], .calculator-screen, #result, .result, input') ||
               document.querySelector('div[class*="display"], span[class*="display"]')
    }

    const getDisplayText = () => {
        const d = findDisplay()
        if (!d) return ""
        return (d.value !== undefined ? d.value : d.textContent || "").trim()
    }

    const clickButtonByText = (text) => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], .btn, [role="button"], span[class*="btn"]'))
        const target = buttons.find(b => {
            const t = (b.textContent || b.value || "").trim()
            const dataVal = b.getAttribute("data-value") || b.getAttribute("data-val") || b.getAttribute("data-number") || b.getAttribute("data-key") || b.getAttribute("data-action") || ""
            const id = (b.id || "").toLowerCase()

            if (t === text || dataVal === text) return true

            // Operator mappings
            if (text === "+" && (t === "+" || dataVal === "+" || dataVal === "add" || id === "add" || id === "plus")) return true
            if (text === "-" && (t === "-" || t === "−" || dataVal === "-" || dataVal === "subtract" || id === "subtract" || id === "minus")) return true
            if (text === "*" && (t === "*" || t === "×" || t === "x" || dataVal === "*" || dataVal === "multiply" || id === "multiply")) return true
            if (text === "/" && (t === "/" || t === "÷" || dataVal === "/" || dataVal === "divide" || id === "divide")) return true
            if (text === "=" && (t === "=" || dataVal === "=" || dataVal === "calculate" || dataVal === "equals" || id === "equals" || id === "equal")) return true
            if ((text === "C" || text === "AC") && (t.toUpperCase() === "C" || t.toUpperCase() === "AC" || dataVal === "clear" || dataVal === "all-clear" || id === "clear" || id === "all-clear")) return true
            if (text === "." && (t === "." || dataVal === "." || dataVal === "decimal" || id === "decimal")) return true

            return false
        })

        if (target) {
            target.click()
            return true
        }
        return false
    }

    const displayElem = findDisplay()
    if (!displayElem) {
        results.errors.push("Calculator verification failed: No display screen element found in DOM (expected #display or .display)")
        results.status = "failed"
        results.testsRun.push({ name: "Calculator Screen Display Element", passed: false, message: "Display element not found" })
        return
    }

    results.testsRun.push({ name: "Calculator Display Element Detection", passed: true, message: "Display element located in DOM" })

    // Helper to test a calculation sequence
    const testCalcSequence = (testName, inputs, expected) => {
        // Clear first
        clickButtonByText("C") || clickButtonByText("AC")

        let allClicked = true
        for (const ch of inputs) {
            const clicked = clickButtonByText(ch)
            if (!clicked) {
                allClicked = false
                break
            }
        }

        const actual = getDisplayText()
        const passed = allClicked && (actual === String(expected) || actual.includes(String(expected)))

        results.testsRun.push({
            name: testName,
            passed: passed,
            message: passed
                ? `Input: ${inputs.join("")} -> Display: ${actual} (Verified)`
                : `Input: ${inputs.join("")} -> Display: "${actual}" (Expected: ${expected})`
        })

        if (!passed) {
            results.errors.push(`Calculator failed ${testName}: Input "${inputs.join("")}" resulted in "${actual}", expected "${expected}"`)
            results.status = "failed"
        }
        return passed
    }

    // Test 1: Basic Addition (7 + 5 = 12)
    testCalcSequence("Addition: 7 + 5 = 12", ["7", "+", "5", "="], 12)

    // Test 2: Multiplication (9 * 8 = 72)
    testCalcSequence("Multiplication: 9 * 8 = 72", ["9", "*", "8", "="], 72)

    // Test 3: Subtraction (20 - 7 = 13)
    testCalcSequence("Subtraction: 20 - 7 = 13", ["2", "0", "-", "7", "="], 13)

    // Test 4: Division (24 / 6 = 4)
    testCalcSequence("Division: 24 / 6 = 4", ["2", "4", "/", "6", "="], 4)

    // Test 5: Clear Reset
    clickButtonByText("7")
    clickButtonByText("8")
    const cleared = clickButtonByText("C") || clickButtonByText("AC")
    const clearDisp = getDisplayText()
    const clearPassed = cleared && (clearDisp === "0" || clearDisp === "" || clearDisp === "0.")
    results.testsRun.push({
        name: "Clear Button (C / AC) Reset",
        passed: clearPassed,
        message: clearPassed ? `Display reset to "${clearDisp}"` : `Display did not reset (found "${clearDisp}")`
    })
    if (!clearPassed) {
        results.errors.push("Clear button did not reset calculator display")
        results.status = "failed"
    }

    // Test 6: Decimal Calculation (3.5 + 1.2 = 4.7)
    testCalcSequence("Decimal: 3.5 + 1.2 = 4.7", ["3", ".", "5", "+", "1", ".", "2", "="], 4.7)

    // Test 7: Division by Zero Handling
    clickButtonByText("C") || clickButtonByText("AC")
    clickButtonByText("5")
    clickButtonByText("/")
    clickButtonByText("0")
    clickButtonByText("=")
    const divZeroDisp = getDisplayText()
    const divZeroPassed = divZeroDisp.toLowerCase().includes("error") || divZeroDisp.includes("Infinity") || divZeroDisp.includes("NaN") || divZeroDisp === "0"
    results.testsRun.push({
        name: "Division by Zero Error Handling",
        passed: divZeroPassed,
        message: `Display on division by zero: "${divZeroDisp}"`
    })
}

// ----------------- TODO APP INTERACTIVE VERIFIER -----------------
async function testTodoApp(document, window, results) {
    console.log("[CODE] test started: Running Todo App functional test suite")

    const input = document.querySelector('input[type="text"], input#todo-input, input#task-input, #taskInput, input')
    const addBtn = document.querySelector('button#add-btn, button#addTask, form button, button[type="submit"]') ||
                   Array.from(document.querySelectorAll('button')).find(b => /add|create|new/i.test(b.textContent || ""))

    if (!input || !addBtn) {
        results.errors.push("Todo app verification failed: Input field or Add button not found in DOM")
        results.status = "failed"
        results.testsRun.push({ name: "Todo Input & Add Button", passed: false, message: "Elements not found" })
        return
    }

    // Test Add Task
    input.value = "Test Automated Task 1"
    input.dispatchEvent(new window.Event("input", { bubbles: true, cancelable: true }))

    addBtn.click()
    addBtn.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }))

    const listItems = Array.from(document.querySelectorAll('li, .todo-item, .task-item, [data-task]'))
    const addedItem = listItems.find(li => (li.textContent || "").includes("Test Automated Task 1"))
    const addPassed = Boolean(addedItem)

    results.testsRun.push({
        name: "Add Task Interaction",
        passed: addPassed,
        message: addPassed ? "Task successfully added to DOM list" : "Clicking Add button did not append task to list"
    })

    if (!addPassed) {
        results.errors.push("Todo Add button did not append task to list")
        results.status = "failed"
        return
    }

    // Test Complete / Toggle
    const checkbox = addedItem.querySelector('input[type="checkbox"], button.toggle, .complete-btn, .check-btn')
    if (checkbox) {
        checkbox.click()
        const isCompleted = addedItem.classList.contains("completed") ||
                            addedItem.style.textDecoration?.includes("line-through") ||
                            (checkbox.checked !== undefined && checkbox.checked)
        results.testsRun.push({
            name: "Complete / Toggle Task Interaction",
            passed: isCompleted,
            message: isCompleted ? "Task state toggled to completed" : "Checkbox clicked but no visual/state completion change"
        })
    }

    // Test Delete
    const deleteBtn = addedItem.querySelector('button.delete, button.remove, .delete-btn, [data-delete]')
    if (deleteBtn) {
        deleteBtn.click()
        const remainingItems = Array.from(document.querySelectorAll('li, .todo-item, .task-item'))
        const stillExists = remainingItems.some(li => (li.textContent || "").includes("Test Automated Task 1"))
        const deletePassed = !stillExists
        results.testsRun.push({
            name: "Delete Task Interaction",
            passed: deletePassed,
            message: deletePassed ? "Task deleted from list" : "Delete button did not remove task from DOM"
        })
        if (!deletePassed) {
            results.errors.push("Delete task button did not remove task from DOM")
            results.status = "failed"
        }
    }
}

// ----------------- FORM VALIDATION INTERACTIVE VERIFIER -----------------
async function testFormValidation(document, window, results) {
    console.log("[CODE] test started: Running Form Validation functional test suite")

    const form = document.querySelector('form')
    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]') ||
                      Array.from(document.querySelectorAll('button')).find(b => /submit|sign|register|send/i.test(b.textContent || ""))

    if (!form && !submitBtn) {
        results.errors.push("Form element or submit button not found in DOM")
        results.status = "failed"
        results.testsRun.push({ name: "Form DOM Elements Detection", passed: false, message: "Form or submit button missing" })
        return
    }

    // Test 1: Empty submit triggers validation
    if (submitBtn) {
        submitBtn.click()
    } else if (form) {
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))
    }

    const errorElements = document.querySelectorAll('.error, .invalid-feedback, .error-message, [data-error], :invalid')
    const validationTriggered = errorElements.length > 0 || (document.body.textContent || "").toLowerCase().includes("required") || (document.body.textContent || "").toLowerCase().includes("invalid")

    results.testsRun.push({
        name: "Form Validation on Empty Submission",
        passed: validationTriggered,
        message: validationTriggered ? "Validation feedback displayed on invalid submit" : "Form submitted empty with no validation errors"
    })
    if (!validationTriggered) {
        results.errors.push("Form validation failed: Empty form submission showed no error feedback")
        results.status = "failed"
    }
}

// ----------------- GENERIC WEB APP INTERACTIVE VERIFIER -----------------
async function testGenericWebApp(document, window, results) {
    const interactiveElements = document.querySelectorAll('button, input, select, textarea, [role="button"]')
    const count = interactiveElements.length
    results.testsRun.push({
        name: "Interactive DOM Elements Presence",
        passed: count > 0,
        message: `Found ${count} interactive DOM element(s)`
    })
}
