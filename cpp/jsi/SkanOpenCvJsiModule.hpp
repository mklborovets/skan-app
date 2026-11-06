#pragma once

#if __has_include(<jsi/jsi.h>)
#include <jsi/jsi.h>
#else
namespace facebook {
namespace jsi {
class Runtime;
}
}
#endif

namespace skan {

class SkanOpenCvJsiModule {
public:
    static void install(facebook::jsi::Runtime& runtime);
};

}

