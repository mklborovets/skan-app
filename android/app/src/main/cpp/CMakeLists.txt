cmake_minimum_required(VERSION 3.22.1)
project(skan_opencv_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CPP_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../cpp")
set(REACT_NATIVE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../node_modules/react-native")

find_package(ReactAndroid REQUIRED CONFIG)

if(DEFINED OPENCV_ANDROID_SDK_DIR AND EXISTS "${OPENCV_ANDROID_SDK_DIR}/sdk/native/jni/OpenCVConfig.cmake")
    set(OpenCV_DIR "${OPENCV_ANDROID_SDK_DIR}/sdk/native/jni")
    find_package(OpenCV REQUIRED COMPONENTS core imgproc imgcodecs)
else()
    find_package(OpenCV QUIET)
endif()

file(GLOB SKAN_CPP_SOURCES
    "${CPP_ROOT_DIR}/src/*.cpp"
    "${CPP_ROOT_DIR}/jsi/*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/*.cpp"
)

if(NOT SKAN_CPP_SOURCES)
    set(SKAN_CPP_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/VisionFrameProcessorAndroid.cpp")
endif()

add_library(skan_opencv SHARED ${SKAN_CPP_SOURCES})

target_include_directories(skan_opencv PUBLIC
    "${CPP_ROOT_DIR}/include"
    "${CPP_ROOT_DIR}/jsi"
    "${CMAKE_CURRENT_SOURCE_DIR}"
    "${REACT_NATIVE_DIR}/ReactCommon/jsi"
)

if(TARGET OpenCV::opencv_java4)
    target_link_libraries(skan_opencv OpenCV::opencv_java4)
elseif(OpenCV_FOUND)
    target_include_directories(skan_opencv PUBLIC ${OpenCV_INCLUDE_DIRS})
    target_link_libraries(skan_opencv ${OpenCV_LIBS})
endif()

find_library(LOG_LIB log)
find_library(ANDROID_LIB android)
find_library(JNIGRAPHICS_LIB jnigraphics)

target_link_libraries(skan_opencv
    ReactAndroid::jsi
    ${LOG_LIB}
    ${ANDROID_LIB}
    ${JNIGRAPHICS_LIB}
)

target_compile_options(skan_opencv PRIVATE
    -O3
    -ffast-math
    -fvisibility=hidden
    -Wall
    -Wextra
)
