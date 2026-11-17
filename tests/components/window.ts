// The mocked window for layout tests. A test file that uses it mocks useWindowDimensions to return mockWindow.
// To change the window during a test: setWindow(...), then rerender the app.
export const mockWindow = { width: 400, height: 800, scale: 2, fontScale: 1 };

export function setWindow(width: number, height = 800, fontScale = 1) {
  Object.assign(mockWindow, { width, height, fontScale });
}
