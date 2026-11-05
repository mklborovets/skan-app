#pragma once

#include <jsi/jsi.h>

namespace skan {

class SkanOpenCvJsiModule {
public:
    static void install(facebook::jsi::Runtime& runtime);
};

}

