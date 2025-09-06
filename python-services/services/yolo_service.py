# yolo_service.py

import cv2
from ultralytics import YOLO
import logging

# --- 1. Define the relevant classes in a set for fast checking ---
# This set contains all the COCO class names that are relevant to trash sorting.
RELEVANT_CLASSES = {
    'bottle', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'wine glass',
    'book', 'vase', 'scissors', 'toothbrush', 'banana', 'apple', 'sandwich',
    'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake'
}


# --- 2. Load the model ONCE when this module is first imported ---
# This is a global variable, so the model is loaded only one time,
# making the application much more efficient.
try:
    logging.info("Loading YOLOv8 model...")
    # 'yolov8n.pt' is the nano version - smallest and fastest.
    model = YOLO('yolov8n.pt')
    logging.info("YOLOv8 model loaded successfully.")
except Exception as e:
    logging.error(f"FATAL: Could not load YOLOv8 model. Error: {e}")
    model = None


# --- 3. Define the main detection function ---
def detect_relevant_objects(frame):
    """
    Takes a single image frame (as a NumPy array), runs YOLOv8 detection,
    filters for relevant classes, and returns the results.

    Args:
        frame (np.ndarray): The image frame captured from the camera.

    Returns:
        tuple: A tuple containing:
            - list: A list of dictionaries, where each dictionary holds the
                    information for one relevant detected object.
            - np.ndarray: The original frame annotated with all bounding boxes
                          for visualization and debugging.
    """
    if model is None:
        logging.error("YOLOv8 model is not loaded. Cannot perform detection.")
        return [], frame # Return empty list and original frame

    # Run YOLOv8 inference on the frame
    results = model(frame)
    
    # Create an empty list to store the results we care about
    detections = []
    
    # The results object contains information about the detections.
    # We loop through each detected box to extract its data.
    if results[0].boxes:
        for box in results[0].boxes:
            # Get the class ID (e.g., 41) and use the model's dictionary to get the name
            try:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                
                # The crucial filtering step:
                # Check if the detected class is in our set of relevant classes.
                if class_name in RELEVANT_CLASSES:
                    # It's a relevant object! Let's store its information.
                    confidence = float(box.conf[0])
                    
                    # Get bounding box in [x_center, y_center, width, height] format
                    bounding_box = box.xywh[0].tolist()
                    
                    # Create a clean dictionary with the essential info
                    detection_info = {
                        'label': class_name,
                        'confidence': confidence,
                        'box': bounding_box
                    }
                    detections.append(detection_info)

            except (IndexError, KeyError) as e:
                logging.warning(f"Could not process a detection box. Error: {e}")
                continue # Move to the next box
            
    # Use the built-in .plot() method to get an image with all boxes drawn on it
    # This is great for debugging or for the live feed in the frontend.
    annotated_frame = results[0].plot()
    
    return detections, annotated_frame


# --- 4. A main block to test this file directly ---
# This special block of code will only run if you execute `python yolo_service.py`
# from your terminal. It will NOT run when this file is imported by another script.
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO) # Configure logging for the test
    print("\n--- Running a live webcam test for yolo_service.py ---")
    print("--- Press 'q' in the display window to quit. ---")
    
    cap = cv2.VideoCapture(0) # Change 0 if you have multiple cameras
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
    else:
        while True:
            success, frame = cap.read()
            if not success:
                print("Error: Failed to grab frame from webcam.")
                break
                
            # Call our main function to get the filtered data and the annotated image
            filtered_detections, annotated_frame = detect_relevant_objects(frame)
            
            # Print the filtered data to the console to see it working in real-time
            if filtered_detections:
                print(filtered_detections)
                
            # Display the annotated frame in a window
            cv2.imshow("YOLOv8 Live Test (Press 'q' to quit)", annotated_frame)
            
            # Exit loop if 'q' is pressed
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        print("\n--- Test finished. ---")