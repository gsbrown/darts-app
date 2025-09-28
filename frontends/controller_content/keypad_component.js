// keypad_component.js

// Ensure React is available
if (typeof React === 'undefined') {
    console.error("Keypad Component Error: React is not defined!");
    // You could throw an error here or display a message on the page
} else {
    // Assign to window object to ensure it's globally accessible
    window.Keypad = ({ initialValue = '', onSubmit, onCancel, title = "Enter Score", children }) => {
        const [inputValue, setInputValue] = React.useState(initialValue);
        const inputRef = React.useRef(null);
        
        React.useEffect(() => { 
            if (inputRef.current) {
                // Attempt to focus. For touch devices, direct focus might not always work
                // without a user interaction, but it's good practice.
                // setTimeout(() => inputRef.current.focus(), 0); // Optional: re-enable if needed
            }
        }, []); // Empty dependency array means this runs once on mount

        const handleInput = (char) => {
            if (char === 'DEL') {
                setInputValue(prev => prev.slice(0, -1));
            } else if (char === 'CLR') {
                setInputValue('');
            } else if (inputValue.length < 3) { // Check current length before appending
                setInputValue(prev => prev + char);
            }
        };

        const handleSubmit = () => {
            const score = parseInt(inputValue, 10);
            if (!isNaN(score)) {
                if (onSubmit) onSubmit(score);
            } else if (inputValue === '' && onSubmit) { 
                // If input is empty, treat as 0 or handle as per game logic via onSubmit
                if (onSubmit) onSubmit(0); // Or handle differently if 0 is not a valid "empty" submission
            } else { 
                // Handle invalid input (e.g., if CLR was hit then Submit, or non-numeric if that were possible)
                const displayElement = inputRef.current?.querySelector('.keypad-display'); 
                if (displayElement) {
                    const originalText = displayElement.textContent; // Or better, store inputValue before changing
                    displayElement.textContent = "Invalid"; 
                    displayElement.style.color = "#EF4444"; // Red
                    setTimeout(() => {
                       if(displayElement) { 
                           displayElement.textContent = inputValue || '0'; // Restore current input or 0
                           displayElement.style.color = "white"; // Restore original color
                       }
                    }, 1500);
                }
                console.warn("Keypad: Invalid input submitted or onSubmit not provided for empty/invalid string.");
            }
        };

        const handleKeyDown = (e) => { 
            if (e.key === 'Enter') handleSubmit(); 
            if (e.key === 'Escape' && onCancel) onCancel(); 
            if (e.key >= '0' && e.key <= '9') handleInput(e.key);
            if (e.key === 'Backspace') handleInput('DEL');
        };

        const keypadButtonsConfig = [
            { display: '1', value: '1' }, { display: '2', value: '2' }, { display: '3', value: '3' },
            { display: '4', value: '4' }, { display: '5', value: '5' }, { display: '6', value: '6' },
            { display: '7', value: '7' }, { display: '8', value: '8' }, { display: '9', value: '9' },
            { display: 'CLR', value: 'CLR' }, { display: '0', value: '0' }, { display: 'DEL', value: 'DEL' }
        ];

        return (
            React.createElement('div', { className: "keypad-overlay", onKeyDown: handleKeyDown, tabIndex: "-1", ref: inputRef },
                React.createElement('div', { className: "keypad" },
                    React.createElement('h3', { className: "text-xl font-semibold text-white text-center mb-2" }, title),
                    children && React.createElement('div', { className: "keypad-children-wrapper mb-2 text-sm text-gray-300 text-center" }, children),
                    React.createElement('div', { className: "keypad-display", tabIndex: "0" }, inputValue || '0'),
                    React.createElement('div', { className: "keypad-grid" },
                        keypadButtonsConfig.map(btn => (
                            React.createElement('button', { 
                                key: btn.display, 
                                onClick: () => handleInput(btn.value), 
                                className: "keypad-button"
                            }, btn.display)
                        ))
                    ),
                    React.createElement('div', { className: "keypad-actions-container" },
                        React.createElement('button', { onClick: onCancel, className: "keypad-button cancel flex-1" }, "Cancel"),
                        React.createElement('button', { onClick: handleSubmit, className: "keypad-button action flex-1" }, "Submit")
                    )
                )
            )
        );
    };
    // Diagnostic log to confirm this file executed and Keypad is defined
    console.log('keypad_component.js (Functional) EXECUTED. Typeof window.Keypad:', typeof window.Keypad);
}
