package org.dromara.jiafeng;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import java.util.*;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.dromara.common.mybatis.core.mapper.LambdaCrudChainWrapper;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.system.domain.SysSocial;
import org.dromara.system.domain.vo.SysSocialVo;
import org.dromara.system.mapper.SysSocialMapper;
import org.dromara.system.service.impl.SysSocialServiceImpl;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class JfSocialAuthorizationTest {
  @BeforeAll static void metadata() {
    TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), "social-security"), SysSocial.class);
  }

  @Test void unlinkUsesOneDeleteBoundToBothCurrentUserAndRequestedRelation() {
    var mapper = mock(SysSocialMapper.class);
    when(mapper.currentModelClass()).thenReturn(SysSocial.class);
    var wrapper = new LambdaCrudChainWrapper<SysSocial, SysSocialVo>(mapper);
    when(mapper.lambda()).thenReturn(wrapper);
    when(mapper.delete(any(Wrapper.class))).thenReturn(1);
    try (var login = mockStatic(LoginHelper.class)) {
      login.when(LoginHelper::getUserId).thenReturn(42L);
      assertTrue(new SysSocialServiceImpl(mapper).deleteWithValidById(99L));
    }
    assertTrue(wrapper.getSqlSegment().contains("id ="));
    assertTrue(wrapper.getSqlSegment().contains("user_id ="));
    assertEquals(Set.of(42L, 99L), new HashSet<>(wrapper.getParamNameValuePairs().values()));
    verify(mapper).delete(wrapper);
    verify(mapper, never()).deleteById(any(java.io.Serializable.class));
  }

  @Test void aRelationOutsideTheOwnerPredicateDoesNotReportSuccessfulDeletion() {
    var mapper = mock(SysSocialMapper.class);
    when(mapper.currentModelClass()).thenReturn(SysSocial.class);
    when(mapper.lambda()).thenAnswer(ignored -> new LambdaCrudChainWrapper<SysSocial, SysSocialVo>(mapper));
    when(mapper.delete(any(Wrapper.class))).thenReturn(0);
    try (var login = mockStatic(LoginHelper.class)) {
      login.when(LoginHelper::getUserId).thenReturn(42L);
      assertFalse(new SysSocialServiceImpl(mapper).deleteWithValidById(99L));
    }
  }
}
