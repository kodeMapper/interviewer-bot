import cv2
cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)
print("isOpened:", cap.isOpened())
ret, frame = cap.read()
print("Read success:", ret)
cap.release()